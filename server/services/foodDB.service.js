import FoodItem from '../models/FoodItem.model.js';

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Lookup a food item from the DB using exact matching only:
 * 1. Exact canonical name match (lowercase)
 * 2. Case-insensitive exact alias match
 *
 * No fuzzy/text search — false positives cause worse nutrition data than AI fallback.
 * The LLM extraction step normalizes dish names to canonical forms, so exact matching
 * is sufficient for the vast majority of cases.
 */
export async function lookupFoodItem(dishName) {
  if (!dishName) return null;
  const normalized = dishName.toLowerCase().trim();

  // 1. Exact canonical name match
  const exact = await FoodItem.findOne({ canonical_name: normalized });
  if (exact) return exact;

  // 2. Case-insensitive exact alias match
  const aliasMatch = await FoodItem.findOne({
    'aliases.alias_text': { $regex: new RegExp('^' + escapeRegex(normalized) + '$', 'i') },
  });
  if (aliasMatch) return aliasMatch;

  // No match — caller will use AI estimation
  return null;
}

/**
 * Get all restaurant portion tiers for a food item.
 */
export function getAllPortionTiers(foodItem) {
  if (!foodItem) return null;

  const restaurantPortions = (foodItem.portions || []).filter(
    p => p.restaurant_multiplier_applied != null
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
 * Get nutrition for a specific portion tier.
 */
export function getFoodNutrition(foodItem, tier = 'standard') {
  if (!foodItem) return null;

  const restaurantPortions = (foodItem.portions || []).filter(
    p => p.restaurant_multiplier_applied != null
  );

  let portion = null;
  if (tier && tier !== 'standard') {
    const label = tier.toLowerCase();
    portion = restaurantPortions.find(p => {
      const pl = (p.label || '').toLowerCase();
      return pl.startsWith(label) || pl.includes(label + ' ');
    });
  }
  if (!portion) portion = restaurantPortions.find(p => p.is_default);
  if (!portion && restaurantPortions.length > 0) portion = restaurantPortions[0];

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
