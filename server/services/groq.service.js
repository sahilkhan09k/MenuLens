import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const VISION_MODEL = 'qwen/qwen3.8-27b';   // Groq vision model available on this account
const TEXT_MODEL   = 'openai/gpt-oss-20b'; // Text-only model for nutrition estimation

// Strip markdown code fences that Groq sometimes wraps around JSON
function stripMarkdown(raw) {
  return raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

// Attempt to repair and parse a JSON array that may have malformed objects.
// Strategy: extract all {...} blobs individually and parse each one.
function repairAndParseArray(raw) {
  // First try clean parse
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (_) {}

  // Extract individual {...} objects using a simple brace-matching scanner
  const objects = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (raw[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        const chunk = raw.slice(start, i + 1);
        try {
          objects.push(JSON.parse(chunk));
        } catch (_) {
          // skip malformed object
        }
        start = -1;
      }
    }
  }
  return objects;
}

// ── Step 1: Extract dishes from menu image ────────────────────────────────────

async function callExtractDishes(imageUrl) {
  // IMPORTANT: Free tier OTPM limit for qwen/qwen3.8-27b is ~1000 tokens.
  // Use a compact prompt and instruct the model to return minified JSON so we
  // fit as many dishes as possible within that budget.
  const prompt = [
    'You are a menu parser. Extract ALL food/beverage items visible in this menu image.',
    '',
    'RULES:',
    '- Only extract items actually printed on the menu. Never invent dishes.',
    '- Normalize dish names to standard English (fix OCR errors, expand abbreviations, translate regional names).',
    '- Skip placeholder text like "Food Item Here".',
    '- Classify category from section headers: starter|main|dessert|beverage|bread|rice|salad|other',
    '- Price: plain number or null. Use FULL price if half/full shown.',
    '',
    'Return ONLY minified JSON (no whitespace, no newlines, no markdown):',
    '{"n":"restaurant name or null","d":[{"nm":"dish name","rn":"raw text","c":"category","p":price_or_null}]}',
    '',
    'Use short keys to save space: n=restaurant_name, d=dishes array, nm=name, rn=raw_name, c=category, p=price.',
    'If menu is unreadable or has no real dishes: {"n":null,"d":[]}',
  ].join('\n');

  const response = await groq.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are a compact menu parser. Return ONLY minified JSON using short keys as instructed. No thinking, no explanation.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ],
    max_tokens: 900,   // Stay under free-tier OTPM limit of 1000 for qwen/qwen3.8-27b
    temperature: 0.1,
  });

  const finishReason = response.choices[0]?.finish_reason;
  const raw = stripMarkdown(response.choices[0]?.message?.content || '');

  if (finishReason === 'length') {
    console.warn('[groq.service] extractDishes: response hit token limit — partial extraction for', imageUrl);
  }

  try {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Truncated — recover whatever complete dish objects exist
      parsed = recoverTruncatedMenuResponse(raw);
    }

    // Handle compact format { n, d: [...] }
    if (parsed && Array.isArray(parsed.d)) {
      return {
        restaurant_name: parsed.n || null,
        restaurant_address: null,
        dishes: normalizeDishes(parsed.d, /* compact */ true),
      };
    }

    // Handle full format { restaurant_name, restaurant_address, dishes: [...] }
    if (parsed && Array.isArray(parsed.dishes)) {
      return {
        restaurant_name: parsed.restaurant_name || parsed.n || null,
        restaurant_address: parsed.restaurant_address || null,
        dishes: normalizeDishes(parsed.dishes, false),
      };
    }

    // Handle plain array format (backward compat)
    if (Array.isArray(parsed)) {
      return {
        restaurant_name: null,
        restaurant_address: null,
        dishes: normalizeDishes(parsed, false),
      };
    }

    console.warn('[groq.service] extractDishes: could not parse response. Raw (first 300):', raw.slice(0, 300));
    return { restaurant_name: null, restaurant_address: null, dishes: [] };
  } catch (err) {
    console.error('[groq.service] extractDishes: unexpected error for', imageUrl, err.message);
    return { restaurant_name: null, restaurant_address: null, dishes: [] };
  }
}

// Normalise dishes array — handles both compact {nm,rn,c,p} and full {name,raw_name,category,price} shapes
function normalizeDishes(items, compact = false) {
  return items
    .filter(item => {
      if (!item) return false;
      const name = compact
        ? (item.nm || item.name || item.raw_name || '').trim()
        : (item.name || item.raw_name || '').trim();
      if (!name || name.length < 2) return false;
      const lower = name.toLowerCase();
      if (lower.includes('food item here') || lower.includes('item here') || lower === 'tbd') return false;
      return true;
    })
    .map(item => ({
      name:        (compact ? (item.nm || item.name || item.rn || '') : (item.name || item.raw_name || '')).trim(),
      raw_name:    (compact ? (item.rn || item.nm || item.raw_name || '') : (item.raw_name || item.name || '')).trim(),
      category:    (compact ? (item.c  || item.category || 'other') : (item.category || 'other')),
      description: item.description || item.desc || '',
      price:       (compact ? (item.p  ?? item.price  ?? null) : (item.price ?? null)),
    }));
}

// When the JSON is truncated, extract all complete dish objects from the partial response
function recoverTruncatedMenuResponse(raw) {
  let restaurant_name = null;

  // Try to find restaurant name in partial JSON
  const nameMatch = raw.match(/"n"\s*:\s*"([^"]+)"/) || raw.match(/"restaurant_name"\s*:\s*"([^"]+)"/);
  if (nameMatch) restaurant_name = nameMatch[1];

  // Extract all complete {...} objects using brace matching
  const allObjects = repairAndParseArray(raw);

  // Filter to only dish-shaped objects (compact or full format)
  const dishObjects = allObjects.filter(obj =>
    obj && typeof obj === 'object' &&
    (obj.nm || obj.name || obj.raw_name) &&
    !('d' in obj) && !('dishes' in obj) && !('restaurant_name' in obj)
  );

  if (dishObjects.length > 0) {
    console.log('[groq.service] extractDishes: recovered ' + dishObjects.length + ' dishes from truncated response');
    // Detect format from first object
    const isCompact = 'nm' in dishObjects[0] || 'rn' in dishObjects[0];
    return { n: restaurant_name, d: dishObjects, _compact: isCompact };
  }

  return { n: restaurant_name, d: [] };
}

export async function extractDishes(imageUrls) {
  const allDishes = [];
  let restaurantName = null;
  let restaurantAddress = null;
  const BATCH_SIZE = 3;

  for (let i = 0; i < imageUrls.length; i += BATCH_SIZE) {
    const batch = imageUrls.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(imageUrls.length / BATCH_SIZE);
    console.log('[groq.service] Processing image batch ' + batchNum + '/' + totalBatches);

    const batchResults = await Promise.all(
      batch.map(async (imageUrl) => {
        console.log('[groq.service] Calling vision model for URL:', imageUrl);
        try {
          return await callExtractDishes(imageUrl);
        } catch (err) {
          console.error('[groq.service] extractDishes: first attempt failed, retrying in 2s...', err.status || '', err.message);
          await new Promise((resolve) => setTimeout(resolve, 2000));
          try {
            return await callExtractDishes(imageUrl);
          } catch (retryErr) {
            console.error('[groq.service] extractDishes: second attempt failed, skipping image.', retryErr.status || '', retryErr.message);
            return { restaurant_name: null, restaurant_address: null, dishes: [] };
          }
        }
      })
    );

    for (const result of batchResults) {
      // Take first non-null restaurant info found across all images
      if (!restaurantName && result.restaurant_name) {
        restaurantName = result.restaurant_name;
      }
      if (!restaurantAddress && result.restaurant_address) {
        restaurantAddress = result.restaurant_address;
      }
      allDishes.push(...result.dishes);
    }
  }

  return { dishes: allDishes, restaurantName, restaurantAddress };
}

// ── Step 2: Batch nutrition estimation ───────────────────────────────────────

// Process a single sub-batch of dishes (max 5 at a time to avoid token truncation)
async function callNutritionBatch(batch) {
  const dishList = batch
    .map((d, i) => (i + 1) + '. Name: "' + d.name + '" | Description: "' + (d.description || 'none') + '"')
    .join('\n');

  const prompt = [
    'You are a precise nutritionist AI with expert knowledge of all restaurant food and beverages.',
    '',
    'Below is a list of menu items. For EACH item, provide accurate nutritional estimates.',
    '',
    'MENU ITEMS:',
    dishList,
    '',
    'CRITICAL RULES you MUST follow:',
    '- BEVERAGES (coffee, tea, juice, soda, water, smoothie, latte, cappuccino, americano, espresso):',
    '  -> calories 0-150 max for plain drinks, protein ~0g, fat ~0g, cookingMethod = "raw"',
    '- DESSERTS (cake, ice cream, brownie, cookie, pastry):',
    '  -> high carbs, low protein, cookingMethod = "baked" or "raw"',
    '- SALADS: low calories, low fat unless dressing-heavy, cookingMethod = "raw"',
    '- GRILLED MEAT/FISH: high protein (20-40g), moderate fat, cookingMethod = "grilled"',
    '- FRIED ITEMS: higher fat, cookingMethod = "fried"',
    '- Never assign food macros to beverages or beverage macros to food',
    '- estimatedIngredients must list REAL ingredients',
    '- confidence: integer 0-100, be honest, set below 50 if uncertain',
    '',
    'Return ONLY a raw JSON array (no markdown, no code fences, no explanation) with exactly ' + batch.length + ' objects in the same order as the input list:',
    '[',
    '  {',
    '    "name": "exact dish name from input",',
    '    "calories": {"min": number, "max": number},',
    '    "protein": {"min": number, "max": number},',
    '    "carbs": {"min": number, "max": number},',
    '    "fat": {"min": number, "max": number},',
    '    "cookingMethod": "grilled" | "fried" | "steamed" | "baked" | "raw" | "unknown",',
    '    "estimatedIngredients": ["ingredient1", "ingredient2"],',
    '    "dishDescription": "4-6 sentences covering key ingredients, preparation, flavour profile and cultural origin.",',
    '    "confidence": integer 0-100,',
    '    "recommendReason": "one honest sentence about a nutritional positive",',
    '    "avoidReasons": ["concern1"] or []',
    '  }',
    ']',
  ].join('\n');

  const response = await groq.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are a precise nutritionist. Give accurate, realistic nutritional data for every menu item. Beverages like Americano have ~5-15 kcal and ~0g protein. Never confuse beverages with food.',
      },
      { role: 'user', content: prompt },
    ],
    max_tokens: 8192,
    temperature: 0.1,
  });

  const finishReason = response.choices[0]?.finish_reason;
  const raw = stripMarkdown(response.choices[0]?.message?.content || '');

  if (finishReason === 'length') {
    console.warn('[groq.service] estimateNutritionBatch: response truncated (finish_reason=length). Parsed partial results.');
  }

  const parsed = repairAndParseArray(raw);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    console.error('[groq.service] estimateNutritionBatch: got empty/invalid array. Raw (first 200):', raw.slice(0, 200));
    return batch.map(() => null);
  }

  if (parsed.length < batch.length) {
    console.warn('[groq.service] estimateNutritionBatch: got ' + parsed.length + '/' + batch.length + ' items — response was likely truncated.');
  }

  return batch.map((_, i) => {
    const item = parsed[i] || null;
    if (item) {
      item.source = 'ai';
      // Normalise confidence: if model returns 0-1 decimal, convert to 0-100
      if (typeof item.confidence === 'number' && item.confidence <= 1) {
        item.confidence = Math.round(item.confidence * 100);
      }
    }
    return item;
  });
}

export async function estimateNutritionBatch(dishes) {
  if (!dishes || dishes.length === 0) return [];

  // Process in sub-batches of 5 to stay well within token limits
  const NUTRITION_BATCH_SIZE = 5;
  const allResults = [];

  for (let i = 0; i < dishes.length; i += NUTRITION_BATCH_SIZE) {
    const batch = dishes.slice(i, i + NUTRITION_BATCH_SIZE);
    const batchNum = Math.floor(i / NUTRITION_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(dishes.length / NUTRITION_BATCH_SIZE);
    console.log('[groq.service] Nutrition batch ' + batchNum + '/' + totalBatches + ' (' + batch.length + ' dishes)');

    try {
      const results = await callNutritionBatch(batch);
      allResults.push(...results);
    } catch (err) {
      console.error('[groq.service] Nutrition batch ' + batchNum + ' failed:', err.status || '', err.message);
      // Fill failed batch slots with null so indices stay aligned
      allResults.push(...batch.map(() => null));
    }
  }

  return allResults;
}
