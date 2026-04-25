import crypto from 'crypto';
import cloudinary from '../config/cloudinary.js';
import Scan from '../models/Scan.model.js';
import Dish from '../models/Dish.model.js';
import User from '../models/User.model.js';
import FoodReviewQueue from '../models/FoodReviewQueue.model.js';
import { extractDishes, estimateNutritionBatch } from '../services/groq.service.js';
import { processDishNutrition } from '../services/nutrition.service.js';
import { scoreDish, generateTags, classifyDish } from '../services/recommendation.service.js';
import { lookupFoodItem, getFoodNutrition } from '../services/foodDB.service.js';
import { findNearestRestaurant } from '../services/places.service.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function hashBuffer(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'image', folder: 'menulens' },
      (err, result) => (err ? reject(err) : resolve(result.secure_url)),
    );
    stream.end(buffer);
  });
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const VALID_COOKING_METHODS = new Set([
  'grilled', 'fried', 'steamed', 'baked', 'raw', 'boiled', 'roasted', 'stir-fried', 'unknown',
]);
const COOKING_METHOD_MAP = {
  'stir fry': 'stir-fried', 'stir-fry': 'stir-fried', 'stirfried': 'stir-fried',
  'deep fried': 'fried', 'deep-fried': 'fried', 'pan fried': 'fried',
  'pan-fried': 'fried', 'shallow fried': 'fried',
  'tandoor': 'grilled', 'tandoori': 'grilled', 'bbq': 'grilled',
  'barbecue': 'grilled', 'smoked': 'grilled',
  'sauteed': 'stir-fried', 'sauteed': 'stir-fried',
  'poached': 'boiled', 'simmered': 'boiled', 'pressure cooked': 'boiled',
  'microwaved': 'baked', 'toasted': 'baked',
};

function normalizeCookingMethod(method) {
  if (!method) return 'unknown';
  const lower = method.toLowerCase().trim();
  if (VALID_COOKING_METHODS.has(lower)) return lower;
  if (COOKING_METHOD_MAP[lower]) return COOKING_METHOD_MAP[lower];
  return 'unknown';
}

// ── async AI pipeline (fire-and-forget) ──────────────────────────────────────

const PARTIAL_SCAN_THRESHOLD = 3;
const LOW_CONFIDENCE_THRESHOLD = 50;
const AI_CONFIDENCE_FLOOR = 65;

async function runAIPipeline(scan, cloudinaryUrls, userProfile) {
  try {
    console.log('[pipeline] Starting for scan ' + scan._id + ', images: ' + cloudinaryUrls.length);

    // Step 1: Extract dishes + restaurant info from images
    const extraction = await extractDishes(cloudinaryUrls);
    const rawDishes = extraction.dishes;
    const extractedRestaurantName = extraction.restaurantName;
    const extractedRestaurantAddress = extraction.restaurantAddress;

    console.log('[pipeline] Extracted ' + rawDishes.length + ' dishes:', rawDishes.map(d => d.name));
    if (extractedRestaurantName) console.log('[pipeline] Restaurant from menu: ' + extractedRestaurantName);
    if (extractedRestaurantAddress) console.log('[pipeline] Address from menu: ' + extractedRestaurantAddress);

    // Update scan with restaurant info from menu image if not already set
    if (extractedRestaurantName && !scan.restaurantName) {
      scan.restaurantName = extractedRestaurantName;
    }
    if (extractedRestaurantAddress) {
      if (!scan.restaurantLocation) scan.restaurantLocation = {};
      if (!scan.restaurantLocation.address) {
        scan.restaurantLocation.address = extractedRestaurantAddress;
      }
    }

    // Deduplicate by normalized name
    const seen = new Set();
    const uniqueDishes = rawDishes.filter(d => {
      const key = d.name.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const duplicatesRemoved = rawDishes.length - uniqueDishes.length;
    if (duplicatesRemoved > 0) {
      console.log('[pipeline] Deduplicated: removed ' + duplicatesRemoved + ' duplicate dish names');
    }

    // Scan quality assessment
    if (uniqueDishes.length === 0) {
      scan.status = 'failed';
      scan.errorMessage = 'no_dishes_found';
      scan.scanQuality = 'unreadable';
      scan.totalDishesFound = 0;
      await scan.save();
      return;
    }

    if (uniqueDishes.length < PARTIAL_SCAN_THRESHOLD) {
      scan.scanQuality = 'partial';
      scan.scanQualityNote = 'Only ' + uniqueDishes.length + ' dish' + (uniqueDishes.length === 1 ? '' : 'es') + ' detected. Image may be blurry, dark, or partially visible.';
    } else {
      scan.scanQuality = 'good';
    }

    // Step 2: DB lookup
    console.log('[pipeline] Looking up ' + uniqueDishes.length + ' dishes in food DB...');
    const dbResults = await Promise.all(uniqueDishes.map((d) => lookupFoodItem(d.name)));
    const dbHits = dbResults.filter(Boolean).length;
    console.log('[pipeline] DB hits: ' + dbHits + '/' + uniqueDishes.length);

    // Step 3: AI batch for misses
    const aiDishes = uniqueDishes.filter((_, i) => !dbResults[i]);
    let aiResults = [];
    if (aiDishes.length > 0) {
      console.log('[pipeline] Sending ' + aiDishes.length + ' dishes to nutrition batch API...');
      aiResults = await estimateNutritionBatch(aiDishes);
      console.log('[pipeline] Got ' + aiResults.filter(Boolean).length + '/' + aiDishes.length + ' AI nutrition results');
    }

    let aiIdx = 0;
    const mergedNutrition = uniqueDishes.map((_, i) => {
      if (dbResults[i]) return null;
      return aiResults[aiIdx++] || null;
    });

    const dishIds = [];
    const recommendedIds = [];
    const goodIds = [];
    const avoidIds = [];

    // Step 4: Process each dish
    for (let i = 0; i < uniqueDishes.length; i++) {
      const rawDish = uniqueDishes[i];
      const dbItem = dbResults[i];
      let nutritionData;
      let dataSource;

      if (dbItem) {
        const dbNutrition = getFoodNutrition(dbItem);
        dataSource = 'database';
        nutritionData = {
          estimatedNutrition: {
            calories: dbNutrition.calories,
            protein:  dbNutrition.protein,
            carbs:    dbNutrition.carbs,
            fat:      dbNutrition.fat,
            fiber:    dbNutrition.fiber,
            sugar:    null,
          },
          confidenceScore: dbNutrition.confidence,
          cookingMethod: dbNutrition.cookingMethod,
          allergenFlags: dbNutrition.allergens,
          recommendReason: '',
          avoidReasons: [],
          estimatedIngredients: [],
          multiplierNote: dbNutrition.multiplierNote || null,
          portionTiers: dbNutrition.portionTiers ? {
            small:    dbNutrition.portionTiers.small    ? { label: dbNutrition.portionTiers.small.label,    weight_grams: dbNutrition.portionTiers.small.weight_grams,    calories_kcal: dbNutrition.portionTiers.small.calories_kcal,    protein_g: dbNutrition.portionTiers.small.protein_g,    carbs_g: dbNutrition.portionTiers.small.carbs_g,    fat_g: dbNutrition.portionTiers.small.fat_g    } : null,
            standard: dbNutrition.portionTiers.standard ? { label: dbNutrition.portionTiers.standard.label, weight_grams: dbNutrition.portionTiers.standard.weight_grams, calories_kcal: dbNutrition.portionTiers.standard.calories_kcal, protein_g: dbNutrition.portionTiers.standard.protein_g, carbs_g: dbNutrition.portionTiers.standard.carbs_g, fat_g: dbNutrition.portionTiers.standard.fat_g } : null,
            large:    dbNutrition.portionTiers.large    ? { label: dbNutrition.portionTiers.large.label,    weight_grams: dbNutrition.portionTiers.large.weight_grams,    calories_kcal: dbNutrition.portionTiers.large.calories_kcal,    protein_g: dbNutrition.portionTiers.large.protein_g,    carbs_g: dbNutrition.portionTiers.large.carbs_g,    fat_g: dbNutrition.portionTiers.large.fat_g    } : null,
          } : null,
        };
        console.log('[pipeline] ' + rawDish.name + ': DB hit (' + dbItem.canonical_name + '), cal=' + dbNutrition.calories?.avg);
      } else {
        const nutritionResult = mergedNutrition[i];
        nutritionData = processDishNutrition(rawDish, nutritionResult);
        dataSource = 'ai';

        if (nutritionData.confidenceScore > 0) {
          nutritionData.confidenceScore = Math.max(AI_CONFIDENCE_FLOOR, nutritionData.confidenceScore);
        }

        if (nutritionResult) {
          console.log('[pipeline] ' + rawDish.name + ': AI cal=' + nutritionResult.calories?.min + '-' + nutritionResult.calories?.max + ', confidence=' + nutritionData.confidenceScore);
        } else {
          console.warn('[pipeline] ' + rawDish.name + ': nutrition result is NULL');
        }
      }

      if (!nutritionData.estimatedNutrition) {
        console.warn('[pipeline] Skipping ' + rawDish.name + ' — no nutrition data available');
        continue;
      }

      const dishPayload = {
        ...rawDish,
        ...nutritionData,
        cookingMethod: normalizeCookingMethod(nutritionData.cookingMethod),
        estimatedIngredients: nutritionData.estimatedIngredients,
      };

      const matchScore = scoreDish(dishPayload, userProfile);
      const tags = generateTags(dishPayload, matchScore);
      const classification = classifyDish({ ...dishPayload, matchScore }, userProfile);

      const dish = await Dish.create({
        scanId: scan._id,
        name: rawDish.name,
        description: rawDish.description || '',
        // Sanitize price — menus with HALF/FULL pricing return objects, not numbers
        // Take the FULL price if available, else HALF, else null
        estimatedPrice: (() => {
          const p = rawDish.price;
          if (p == null) return undefined;
          if (typeof p === 'number') return p;
          if (typeof p === 'object') {
            const full = p.FULL ?? p.full ?? p.Full;
            const half = p.HALF ?? p.half ?? p.Half;
            const val = full ?? half ?? Object.values(p)[0];
            return typeof val === 'number' ? val : undefined;
          }
          const parsed = parseFloat(p);
          return isNaN(parsed) ? undefined : parsed;
        })(),
        estimatedNutrition: nutritionData.estimatedNutrition,
        confidenceScore: nutritionData.confidenceScore,
        cookingMethod: normalizeCookingMethod(nutritionData.cookingMethod),
        matchScore,
        tags,
        allergenFlags: dishPayload.allergenFlags || [],
        recommendReason: nutritionData.recommendReason || '',
        avoidReasons: [
          ...(nutritionData.avoidReasons || []),
          ...(dishPayload._conditionReasons || []),
        ],
        dataSource,
        multiplierNote: nutritionData.multiplierNote || null,
        portionTiers: nutritionData.portionTiers || null,
        scoreBreakdown: dishPayload.scoreBreakdown || null,
      });

      dishIds.push(dish._id);
      if (classification === 'recommended') recommendedIds.push(dish._id);
      if (classification === 'good')        goodIds.push(dish._id);
      if (classification === 'avoid')       avoidIds.push(dish._id);

      // Auto-log AI-sourced dishes to review queue
      if (dataSource === 'ai') {
        try {
          const confidence = nutritionData.confidenceScore || 0;
          const priority = 3 + (confidence < 70 ? 10 : 0);
          const escapedName = escapeRegex(rawDish.name);

          const existing = await FoodReviewQueue.findOne({
            dish_name: { $regex: new RegExp('^' + escapedName + '$', 'i') },
            entry_type: 'ai_sourced',
            status: 'pending',
          });

          if (existing) {
            existing.scan_count += 1;
            existing.priority_score = (existing.scan_count * 3) + (confidence < 70 ? 10 : 0);
            existing.last_seen_at = new Date();
            await existing.save();
            console.log('[pipeline] Review queue: incremented count for "' + rawDish.name + '" (count=' + existing.scan_count + ')');
          } else {
            await FoodReviewQueue.create({
              entry_type: 'ai_sourced',
              dish_name: rawDish.name,
              raw_name: rawDish.raw_name || rawDish.name,
              scan_count: 1,
              ai_nutrition: {
                calories_min: nutritionData.estimatedNutrition?.calories?.min,
                calories_max: nutritionData.estimatedNutrition?.calories?.max,
                protein_min:  nutritionData.estimatedNutrition?.protein?.min,
                protein_max:  nutritionData.estimatedNutrition?.protein?.max,
                carbs_min:    nutritionData.estimatedNutrition?.carbs?.min,
                carbs_max:    nutritionData.estimatedNutrition?.carbs?.max,
                fat_min:      nutritionData.estimatedNutrition?.fat?.min,
                fat_max:      nutritionData.estimatedNutrition?.fat?.max,
                cooking_method: nutritionData.cookingMethod,
                estimated_ingredients: nutritionData.estimatedIngredients || [],
                confidence,
                recommend_reason: nutritionData.recommendReason || '',
                avoid_reasons: nutritionData.avoidReasons || [],
              },
              priority_score: priority,
            });
            console.log('[pipeline] Review queue: added "' + rawDish.name + '"');
          }
        } catch (qErr) {
          console.warn('[pipeline] Could not log to review queue:', qErr.message);
        }
      }
    }

    scan.status = 'complete';
    scan.dishes = dishIds;
    scan.recommendedDishes = recommendedIds;
    scan.avoidDishes = avoidIds;
    scan.totalDishesFound = dishIds.length;
    scan.totalMatchingDishes = recommendedIds.length;
    scan.totalFlaggedDishes = avoidIds.length;

    // Post-pipeline quality check
    if (scan.scanQuality !== 'partial') {
      const allDishes = await Dish.find({ scanId: scan._id }).select('confidenceScore dataSource');
      const aiOnlyDishes = allDishes.filter(d => d.dataSource === 'ai');
      if (aiOnlyDishes.length > 0) {
        const avgConfidence = aiOnlyDishes.reduce((sum, d) => sum + (d.confidenceScore || 0), 0) / aiOnlyDishes.length;
        if (avgConfidence < LOW_CONFIDENCE_THRESHOLD) {
          scan.scanQuality = 'low_confidence';
          scan.scanQualityNote = 'Average AI confidence is ' + Math.round(avgConfidence) + '%. Results may be inaccurate — try a clearer photo.';
        }
      }
    }

    await scan.save();
    console.log('[pipeline] Done. ' + dishIds.length + ' dishes saved, ' + recommendedIds.length + ' recommended, ' + avoidIds.length + ' flagged.');
  } catch (err) {
    console.error('[scan] AI pipeline error:', err.message);
    // Delete the scan entirely on failure — no point keeping a failed empty scan in DB
    try {
      await Dish.deleteMany({ scanId: scan._id });
      await scan.deleteOne();
      console.log('[pipeline] Cleaned up failed scan ' + scan._id);
    } catch (cleanupErr) {
      console.error('[pipeline] Cleanup failed:', cleanupErr.message);
      // Fallback: at least mark it failed so UI can handle it
      scan.status = 'failed';
      scan.errorMessage = err.message;
      await scan.save().catch(() => {});
    }
  }
}

// ── controllers ───────────────────────────────────────────────────────────────

export async function uploadScan(req, res) {
  try {
    if (!req.files || req.files.length === 0 || req.files.length > 10) {
      return res.status(400).json({ message: 'Please upload 1-10 images.' });
    }

    const hashes = req.files.map((f) => hashBuffer(f.buffer));
    const cloudinaryUrls = await Promise.all(req.files.map((f) => uploadToCloudinary(f.buffer)));

    // Priority order for restaurant name:
    // 1. User typed it manually
    // 2. Google Places API (from GPS coords)
    // 3. Extracted from menu image by AI (done in pipeline)
    let restaurantName = req.body.restaurantName || '';
    let restaurantLocation = null;

    const lat = parseFloat(req.body.lat);
    const lng = parseFloat(req.body.lng);

    if (!isNaN(lat) && !isNaN(lng)) {
      restaurantLocation = { lat, lng };
      if (!restaurantName) {
        try {
          const place = await findNearestRestaurant(lat, lng);
          if (place) {
            restaurantName = place.name;
            restaurantLocation.address = place.address;
            restaurantLocation.placeId = place.placeId;
            console.log('[scan] Auto-filled restaurant from Places API: ' + restaurantName);
          }
        } catch (placesErr) {
          console.warn('[scan] Places API failed:', placesErr.message);
        }
      }
    }

    const scan = await Scan.create({
      userId: req.user.id,
      restaurantName,
      restaurantLocation,
      images: cloudinaryUrls,
      imageHashes: hashes,
      status: 'processing',
    });

    res.status(202).json({ scanId: scan._id });

    const userDoc = await User.findById(req.user.id).select('profile');
    runAIPipeline(scan, cloudinaryUrls, userDoc?.profile || {});
  } catch (err) {
    console.error('[scan] uploadScan error:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
}

export async function getScan(req, res) {
  try {
    const scan = await Scan.findOne({
      _id: req.params.scanId,
      userId: req.user.id,
    }).populate('dishes recommendedDishes avoidDishes');

    if (!scan) return res.status(404).json({ message: 'Scan not found.' });
    res.json(scan);
  } catch (err) {
    console.error('[scan] getScan error:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
}

export async function getHistory(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const [scans, total] = await Promise.all([
      Scan.find({ userId: req.user.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Scan.countDocuments({ userId: req.user.id }),
    ]);

    res.json({ scans, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('[scan] getHistory error:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
}

export async function getLastScan(req, res) {
  try {
    const scans = await Scan.find({ userId: req.user.id, status: 'complete' })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('_id restaurantName restaurantLocation totalDishesFound createdAt scanQuality')
      .lean();

    res.json({ scans });
  } catch (err) {
    console.error('[scan] getLastScan error:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
}

export async function toggleSave(req, res) {
  try {
    const scan = await Scan.findOne({ _id: req.params.scanId, userId: req.user.id });
    if (!scan) return res.status(404).json({ message: 'Scan not found.' });

    scan.isSaved = !scan.isSaved;
    await scan.save();
    res.json(scan);
  } catch (err) {
    console.error('[scan] toggleSave error:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
}

export async function deleteScan(req, res) {
  try {
    const scan = await Scan.findOne({ _id: req.params.scanId, userId: req.user.id });
    if (!scan) return res.status(404).json({ message: 'Scan not found.' });

    await Dish.deleteMany({ scanId: scan._id });
    await scan.deleteOne();
    res.json({ message: 'Scan deleted.' });
  } catch (err) {
    console.error('[scan] deleteScan error:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
}
