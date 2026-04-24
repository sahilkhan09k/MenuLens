import FoodItem from '../models/FoodItem.model.js';

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Lookup a food item from the DB using multiple strategies:
 * 1. Exact canonical match
 * 2. Alias match
 * 3. MongoDB $text search
 * 4. Fuzzy: word-level match against canonical_name
 */
export async function lookupFoodItem(dishName) {
  if (!dishName) return null;
  const normalized = dishName.toLowerCase().trim();
  const isDevanagari = /[\u0900-\u097F]/.test(dishName);

  // 1. Exact canonical match (Latin only)
  if (!isDevanagari) {
    const item = await FoodItem.findOne({ canonical_name: normalized });
    if (item) return item;
  }

  // 2. Alias match — handles Devanagari, OCR variants, abbreviations
  const aliasItem = await FoodItem.findOne({
    'aliases.alias_text': isDevanagari
      ? dishName
      : { $regex: new RegExp(`^${escapeRegex(normalized)}$`, 'i') },
  });
  if (aliasItem) return aliasItem;

  // 3. Text search (uses $text index on display_name_en + aliases.alias_text)
  // Only accept if the result name shares the majority of words with the query
  if (!isDevanagari) {
    const textResults = await FoodItem.find(
      { $text: { $search: normalized } },
      { score: { $meta: 'textScore' } }
    ).sort({ score: { $meta: 'textScore' } }).limit(3);

    if (textResults.length > 0) {
      const queryWords = normalized.split(/\s+/).filter(w => w.length > 2);
      for (const result of textResults) {
        const resultWords = new Set(result.canonical_name.split(/\s+/).filter(w => w.length > 2));
        const overlap = queryWords.filter(w => resultWords.has(w)).length;
        const overlapRatio = queryWords.length > 0 ? overlap / queryWords.length : 0;
        // Require at least 60% overlap AND at least 2 words must match
        // This prevents "Chilli Prawn" matching "onion-green chilli parantha" via just "chilli"
        if (overlapRatio >= 0.6 && overlap >= 2) return result;
      }
    }
  }

  // 4. Fuzzy: require at least 2 significant words to match, or a highly specific single word
  // Avoids false positives like "Majestic Chicken" matching "Chicken Tikka" via "chicken"
  if (!isDevanagari) {
    const words = normalized.split(/\s+/).filter((w) => w.length > 4); // >4 chars = more specific
    // Only do single-word fuzzy if the word is very specific (not generic like "chicken", "paneer", "rice")
    const genericWords = new Set(['chicken', 'paneer', 'mutton', 'prawn', 'mushroom', 'fried', 'rice',
      'noodles', 'soup', 'curry', 'masala', 'gravy', 'roast', 'kebab', 'tikka', 'biryani']);
    const specificWords = words.filter(w => !genericWords.has(w));

    if (specificWords.length >= 2) {
      // Need at least 2 specific words to match — reduces false positives
      const regexParts = specificWords.map(w => `(?=.*${escapeRegex(w)})`).join('');
      const fuzzy = await FoodItem.findOne({
        canonical_name: { $regex: new RegExp(regexParts, 'i') },
      });
      if (fuzzy) return fuzzy;
    } else if (specificWords.length === 1) {
      // Single specific non-generic word — only match if it's a strong identifier
      const fuzzy = await FoodItem.findOne({
        canonical_name: { $regex: new RegExp(`\\b${escapeRegex(specificWords[0])}\\b`, 'i') },
      });
      if (fuzzy) return fuzzy;
    }
  }

  return null;
}

/**
 * Get all restaurant portion tiers for a food item.
 * Returns { small, standard, large } — each with full nutrition.
 */
export function getAllPortionTiers(foodItem) {
  if (!foodItem) return null;

  const restaurantPortions = (foodItem.portions || []).filter(
    (p) => p.restaurant_multiplier_applied != null
  );

  if (restaurantPortions.length === 0) return null;

  const tiers = {};
  for (const p of restaurantPortions) {
    const label = (p.label || '').toLowerCase();
    let tier = 'standard';
    if (label.startsWith('small') || label.includes('small ')) tier = 'small';
    else if (label.startsWith('large') || label.includes('large ')) tier = 'large';
    else if (label.startsWith('home') || label.includes('home recipe')) tier = 'home_recipe';
    tiers[tier] = p;
  }

  return tiers;
}

/**
 * Get nutrition for a specific portion tier (small/standard/large).
 * Falls back to standard, then first available portion.
 */
export function getFoodNutrition(foodItem, tier = 'standard') {
  if (!foodItem) return null;

  const restaurantPortions = (foodItem.portions || []).filter(
    (p) => p.restaurant_multiplier_applied != null
  );

  let portion = null;

  if (tier && tier !== 'standard') {
    const label = tier.toLowerCase();
    portion = restaurantPortions.find((p) => {
      const pl = (p.label || '').toLowerCase();
      return pl.startsWith(label) || pl.includes(label + ' ');
    });
  }

  if (!portion) portion = restaurantPortions.find((p) => p.is_default);
  if (!portion && restaurantPortions.length > 0) portion = restaurantPortions[0];

  // Final fallback: scale per_100g to 250g
  const p100 = foodItem.per_100g || {};
  const scale = portion ? 1 : 2.5;
  const cal     = portion?.calories_kcal ?? (p100.calories_kcal != null ? p100.calories_kcal * scale : null);
  const protein = portion?.protein_g     ?? (p100.protein_g     != null ? p100.protein_g     * scale : null);
  const carbs   = portion?.carbs_g       ?? (p100.carbs_g       != null ? p100.carbs_g       * scale : null);
  const fat     = portion?.fat_g         ?? (p100.fat_g         != null ? p100.fat_g         * scale : null);
  const fiber   = portion?.fiber_g       ?? (p100.fiber_g       != null ? p100.fiber_g       * scale : null);
  const sodium  = portion?.sodium_mg     ?? (p100.sodium_mg     != null ? p100.sodium_mg     * scale : null);

  const mkRange = (v) => v != null ? { min: Math.round(v * 0.9), max: Math.round(v * 1.1), avg: Math.round(v) } : null;
  const mkMacro = (v) => v != null ? { min: Math.round(v * 0.9 * 10) / 10, max: Math.round(v * 1.1 * 10) / 10, avg: Math.round(v * 10) / 10 } : null;

  return {
    calories: mkRange(cal),
    protein:  mkMacro(protein),
    carbs:    mkMacro(carbs),
    fat:      mkMacro(fat),
    fiber:    fiber  != null ? Math.round(fiber  * 10) / 10 : null,
    sodium:   sodium != null ? Math.round(sodium)           : null,
    cookingMethod: foodItem.cooking_method || 'unknown',
    allergens: foodItem.allergens || [],
    confidence: foodItem.data_quality_score ?? 90,
    source: 'database',
    portionLabel: portion?.label || null,
    weightGrams:  portion?.weight_grams || null,
    multiplierNote: portion?.multiplier_note || null,
    portionTiers: getAllPortionTiers(foodItem),
  };
}
