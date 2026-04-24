/**
 * Processes raw dish data and Groq nutrition result into a structured nutrition object.
 * All values come directly from the AI — nothing is hardcoded.
 *
 * @param {Object} rawDish - The raw dish from menu extraction { name, description, price }
 * @param {Object|null} groqResult - The nutrition estimate from Groq, or null on failure
 * @returns {Object} Processed nutrition data
 */
export function processDishNutrition(rawDish, groqResult) {
  if (groqResult === null) {
    return {
      estimatedNutrition: null,
      confidenceScore: 0,
      cookingMethod: 'unknown',
      estimatedIngredients: [],
      recommendReason: '',
      avoidReasons: [],
    };
  }

  const computeMacro = (macro) => {
    const min = macro?.min ?? 0;
    const max = macro?.max ?? 0;
    const avg = (min + max) / 2;
    return { min, max, avg };
  };

  const confidenceScore = Math.max(0, Math.min(100, groqResult.confidence ?? 0));

  return {
    estimatedNutrition: {
      calories: computeMacro(groqResult.calories),
      protein: computeMacro(groqResult.protein),
      carbs: computeMacro(groqResult.carbs),
      fat: computeMacro(groqResult.fat),
    },
    confidenceScore,
    cookingMethod: groqResult.cookingMethod || 'unknown',
    estimatedIngredients: groqResult.estimatedIngredients || [],
    recommendReason: groqResult.recommendReason || '',
    avoidReasons: Array.isArray(groqResult.avoidReasons) ? groqResult.avoidReasons : [],
  };
}
