/**
 * Recommendation Service — Evidence-based dish scoring
 *
 * Research basis:
 * - Protein targets: 0.3–0.4g/kg per meal (Schoenfeld & Aragon 2018 meta-analysis, NIH PMC6566799)
 * - Calorie distribution: 30% of TDEE per main meal (standard dietetics)
 * - TDEE: Mifflin-St Jeor BMR × activity multiplier (Academy of Nutrition and Dietetics)
 * - Fiber & satiety: NIH PMC6360548, PMC6352252 — soluble fiber reduces energy intake
 * - Fiber & diabetes: CDC, ADA, NIH PMC11884502 — fiber blunts postprandial glucose spikes
 * - Saturated fat vs total fat: JACC 2020 (Astrup et al.), AHA — saturated fat drives CVD risk, not total fat
 * - Health conditions: AHA dietary guidelines, DASH diet (NIH NBK482514), ADA diabetes guidelines
 */

// ── TDEE calculation (Mifflin-St Jeor) ───────────────────────────────────────

const ACTIVITY_MULTIPLIERS = {
  sedentary:         1.2,
  lightly_active:    1.375,
  moderately_active: 1.55,
  very_active:       1.725,
  extra_active:      1.9,
};

function calculateTDEE(profile) {
  const { gender, age, weight, height, activityLevel } = profile;
  if (!weight || !height) return null;

  const a = age || 30;
  // Mifflin-St Jeor
  const bmr = gender === 'female'
    ? (10 * weight) + (6.25 * height) - (5 * a) - 161
    : (10 * weight) + (6.25 * height) - (5 * a) + 5;

  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] || 1.55;
  return Math.round(bmr * multiplier);
}

// ── Allergen detection ────────────────────────────────────────────────────────

const ALLERGEN_KEYWORDS = {
  peanuts:   ['peanut', 'groundnut'],
  shellfish: ['shrimp', 'prawn', 'crab', 'lobster', 'shellfish', 'scallop'],
  dairy:     ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'paneer', 'ghee', 'curd', 'dairy', 'malai', 'khoya', 'mawa'],
  gluten:    ['wheat', 'flour', 'bread', 'pasta', 'gluten', 'barley', 'rye', 'maida', 'atta', 'naan', 'roti', 'paratha'],
  eggs:      ['egg', 'eggs', 'mayonnaise', 'mayo'],
  fish:      ['fish', 'salmon', 'tuna', 'cod', 'tilapia', 'anchovy', 'mackerel', 'pomfret'],
  tree_nuts: ['almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut', 'kaju', 'badam'],
  soy:       ['soy', 'tofu', 'edamame', 'miso', 'tempeh'],
};

function detectAllergens(dish) {
  const text = [
    ...(dish.estimatedIngredients || []),
    dish.name || '',
    dish.description || '',
  ].join(' ').toLowerCase();

  const found = [];
  for (const [allergen, keywords] of Object.entries(ALLERGEN_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) found.push(allergen);
  }
  return found;
}

// ── Meat detection ────────────────────────────────────────────────────────────

const MEAT_KEYWORDS = [
  'chicken', 'mutton', 'lamb', 'beef', 'pork', 'turkey', 'duck',
  'meat', 'bacon', 'ham', 'sausage', 'pepperoni', 'keema', 'gosht',
  'prawn', 'shrimp', 'fish', 'crab', 'lobster', 'seafood',
];

function containsMeat(dish) {
  const text = [...(dish.estimatedIngredients || []), dish.name || ''].join(' ').toLowerCase();
  return MEAT_KEYWORDS.some(kw => text.includes(kw));
}

// ── Dish characteristic helpers ───────────────────────────────────────────────

function getDishCharacteristics(dish) {
  const name = (dish.name || '').toLowerCase();
  const ingredients = (dish.estimatedIngredients || []).join(' ').toLowerCase();
  const text = name + ' ' + ingredients;
  const method = dish.cookingMethod || 'unknown';

  return {
    text,
    isDeepFried:   method === 'fried' || text.includes('fried') || text.includes('crispy'),
    isGrilled:     ['grilled', 'roasted', 'baked', 'tandoori'].includes(method) || text.includes('tandoor'),
    isSteamed:     method === 'steamed' || method === 'boiled',
    isHighSodium:  text.includes('pickle') || text.includes('papad') || text.includes('manchurian') ||
                   text.includes('schezwan') || text.includes('hakka') || text.includes('soy sauce'),
    isHighSugar:   text.includes('gulab') || text.includes('halwa') || text.includes('kheer') ||
                   text.includes('mithai') || text.includes('jalebi') || text.includes('ladoo') ||
                   text.includes('sweet') || text.includes('dessert'),
    isSpicy:       text.includes('chilli') || text.includes('chili') || text.includes('spicy') ||
                   text.includes('pepper') || text.includes('mirch'),
    isDal:         text.includes('dal') || text.includes('daal') || text.includes('lentil') ||
                   text.includes('chana') || text.includes('rajma') || text.includes('sambhar'),
    isFish:        text.includes('fish') || text.includes('salmon') || text.includes('tuna') ||
                   text.includes('pomfret') || text.includes('mackerel'),
    isOnionGarlic: text.includes('onion') || text.includes('garlic'),
  };
}

// ── Health condition scoring ──────────────────────────────────────────────────
// Penalties based on AHA, DASH (NIH), ADA guidelines
// Bonuses based on same sources — penalty-only systems leave no "good" options

function applyConditionScoring(dish, conditions, nutrition, chars) {
  if (!conditions || conditions.length === 0 || conditions.includes('none')) {
    return { delta: 0, reasons: [] };
  }

  const fiber   = nutrition.fiber  || 0;  // g — from DB or AI
  const satFat  = nutrition.saturatedFat || 0; // g — from DB (saturated_fat_g)
  const totalFat = nutrition.fat?.avg || 0;
  const protein = nutrition.protein?.avg || 0;
  const carbs   = nutrition.carbs?.avg || 0;
  const cal     = nutrition.calories?.avg || 0;

  let delta = 0;
  const reasons = [];

  for (const condition of conditions) {
    switch (condition) {

      case 'diabetes':
        // Penalties — ADA: limit refined carbs, sugar, fried foods
        if (chars.isHighSugar)          { delta -= 30; reasons.push('High sugar — avoid with diabetes'); }
        else if (carbs > 60)            { delta -= 20; reasons.push('High carbs can spike blood sugar'); }
        else if (carbs > 40)            { delta -= 10; reasons.push('Moderate carbs — monitor portion'); }
        if (chars.isDeepFried)          { delta -= 15; reasons.push('Fried foods worsen insulin resistance'); }
        // Bonuses — ADA: fiber blunts glucose spikes (NIH PMC11884502, CDC)
        if (fiber >= 6)                 { delta += 15; reasons.push('High fiber slows glucose absorption'); }
        else if (fiber >= 3)            { delta += 7;  reasons.push('Good fiber content for blood sugar'); }
        if (chars.isSteamed)            { delta += 10; reasons.push('Steamed/boiled — low glycemic impact'); }
        if (protein >= 20 && carbs < 20){ delta += 12; reasons.push('High protein, low carb — ideal for diabetes'); }
        if (chars.isDal)                { delta += 10; reasons.push('Lentils/legumes have low glycemic index'); }
        break;

      case 'hypertension':
        // Penalties — DASH diet: limit sodium, saturated fat
        if (chars.isHighSodium)         { delta -= 25; reasons.push('High sodium raises blood pressure'); }
        if (satFat > 6)                 { delta -= 15; reasons.push('High saturated fat linked to hypertension'); }
        else if (totalFat > 25 && satFat === 0) { delta -= 8; reasons.push('High fat content — monitor intake'); } // fallback if satFat not available
        if (chars.isDeepFried)          { delta -= 10; reasons.push('Fried foods increase cardiovascular risk'); }
        // Bonuses — DASH: potassium-rich foods, legumes, grilled
        if (chars.isDal)                { delta += 12; reasons.push('Legumes support healthy blood pressure (DASH)'); }
        if (chars.isGrilled)            { delta += 8;  reasons.push('Grilled preparation — heart-friendly'); }
        if (fiber >= 5)                 { delta += 8;  reasons.push('Fiber supports blood pressure management'); }
        break;

      case 'high_cholesterol':
        // Penalties — AHA: saturated fat raises LDL (not total fat)
        if (satFat > 8)                 { delta -= 25; reasons.push('High saturated fat raises LDL cholesterol'); }
        else if (satFat > 5)            { delta -= 15; reasons.push('Moderate saturated fat — limit intake'); }
        else if (chars.isDeepFried && satFat === 0) { delta -= 20; reasons.push('Fried foods raise LDL cholesterol'); }
        // Bonuses — AHA: soluble fiber reduces LDL
        if (fiber >= 6)                 { delta += 15; reasons.push('Soluble fiber reduces LDL cholesterol (AHA)'); }
        else if (fiber >= 3)            { delta += 7;  reasons.push('Fiber helps manage cholesterol'); }
        if (chars.isFish)               { delta += 12; reasons.push('Fish omega-3s reduce triglycerides'); }
        if (chars.isDal)                { delta += 10; reasons.push('Legumes lower LDL cholesterol'); }
        break;

      case 'heart_disease':
        // Penalties — AHA: saturated fat, fried, high sodium
        if (satFat > 8)                 { delta -= 30; reasons.push('High saturated fat strains cardiovascular health'); }
        else if (satFat > 5)            { delta -= 18; reasons.push('Elevated saturated fat — caution for heart'); }
        else if (chars.isDeepFried && satFat === 0) { delta -= 25; reasons.push('Fried foods increase heart disease risk'); }
        if (chars.isHighSodium)         { delta -= 20; reasons.push('Excess sodium increases cardiac workload'); }
        // Bonuses — AHA: fiber, fish, grilled
        if (fiber >= 6)                 { delta += 12; reasons.push('Fiber reduces cardiovascular risk (AHA)'); }
        if (chars.isFish)               { delta += 15; reasons.push('Fish omega-3s are cardioprotective'); }
        if (chars.isGrilled)            { delta += 10; reasons.push('Grilled/baked — heart-healthy preparation'); }
        break;

      case 'kidney_disease':
        // CKD protein limit: 0.6–0.8g/kg/day (not on dialysis)
        // For 70kg person: 42–56g/day total → a single 20g protein meal = ~40-50% of daily limit
        // Source: KDOQI Clinical Practice Guidelines for Nutrition in CKD
        // Using body weight if available, else conservative 70kg default
        {
          const ckdDailyLimit = (userProfile.weight || 70) * 0.7; // midpoint of 0.6–0.8g/kg
          const ckdMealLimit  = ckdDailyLimit * 0.33; // 1/3 of daily across 3 meals
          if (protein > ckdMealLimit * 1.5)      { delta -= 25; reasons.push('Very high protein — significantly over CKD safe limit'); }
          else if (protein > ckdMealLimit)        { delta -= 15; reasons.push('High protein — over recommended CKD meal limit'); }
          else if (protein > ckdMealLimit * 0.7)  { delta -= 8;  reasons.push('Moderate protein — approaching CKD limit'); }
          if (chars.isHighSodium)                 { delta -= 20; reasons.push('High sodium worsens kidney function'); }
          // Bonus: low protein, steamed, no sodium
          if (protein <= ckdMealLimit * 0.5 && !chars.isHighSodium) { delta += 10; reasons.push('Low protein and sodium — kidney-friendly'); }
        }
        break;

      case 'obesity':
        // Penalties — calorie-dense, fried
        if (chars.isDeepFried)          { delta -= 20; reasons.push('Fried foods are calorie-dense'); }
        if (cal > 700)                  { delta -= 15; reasons.push('Very high calorie dish'); }
        // Bonuses — high fiber = satiety
        if (fiber >= 6)                 { delta += 10; reasons.push('High fiber promotes satiety'); }
        if (chars.isGrilled && cal < 400) { delta += 8; reasons.push('Low calorie grilled option'); }
        break;

      case 'gerd':
        // Penalties — fried, spicy, high fat delay gastric emptying
        if (chars.isDeepFried)          { delta -= 20; reasons.push('Fried foods trigger acid reflux'); }
        if (chars.isSpicy)              { delta -= 20; reasons.push('Spicy food worsens GERD symptoms'); }
        if (totalFat > 25)              { delta -= 15; reasons.push('High fat delays gastric emptying'); }
        // Bonus: steamed, low fat
        if (chars.isSteamed && !chars.isSpicy) { delta += 10; reasons.push('Steamed food is gentle on digestion'); }
        break;

      case 'ibs':
        // Conservative rules — only universally agreed triggers
        // FODMAP detection removed: onion/garlic appear in 70%+ of North Indian dishes
        // making the entire menu look like Avoid, which destroys trust
        // Research: fat and fried are the most consistent, evidence-backed IBS triggers
        // (Healthline, IBS Game Changer, theibsdietitian.com)
        if (chars.isDeepFried)          { delta -= 15; reasons.push('Fried foods are a common IBS trigger'); }
        if (totalFat > 20)              { delta -= 10; reasons.push('High fat content can trigger IBS symptoms'); }
        if (chars.isSteamed && totalFat <= 15) { delta += 8; reasons.push('Low-fat steamed preparation — gentle on digestion'); }
        break;

      case 'anemia':
        // Heme iron (meat/fish) — 15–35% absorption rate (NIH PMC2725368)
        // Non-heme iron (dal, spinach) — 2–20% absorption rate, enhanced by vitamin C
        // Inhibitors: dairy/calcium blocks iron absorption (ResearchGate iron bioavailability)
        // Source: NIH PMC6940487 — ascorbic acid reverses calcium/dairy inhibition
        if (chars.isFish)               { delta += 15; reasons.push('Fish provides highly bioavailable heme iron'); }
        else if (containsMeat(dish))    { delta += 12; reasons.push('Meat provides heme iron — best absorbed form'); }
        if (chars.isDal)                { delta += 8;  reasons.push('Lentils provide non-heme iron'); }
        // Spinach/palak/methi — non-heme iron sources common in Indian menus
        if (/palak|spinach|methi|fenugreek/i.test(chars.text)) { delta += 8; reasons.push('Leafy greens provide non-heme iron'); }
        // Vitamin C enhances non-heme iron absorption
        if (/lemon|nimbu|amla|tomato/i.test(chars.text)) { delta += 5; reasons.push('Vitamin C content enhances iron absorption'); }
        // Dairy inhibits iron absorption (calcium competes with iron for absorption)
        if (/lassi|milk|curd|yogurt|raita|chai|tea/i.test(chars.text)) { delta -= 10; reasons.push('Dairy/tea inhibits iron absorption'); }
        break;
    }
  }

  // Cap total condition delta to prevent extreme swings
  return { delta: Math.max(-50, Math.min(30, delta)), reasons };
}

// ── Main scoring function ─────────────────────────────────────────────────────

export function scoreDish(dish, userProfile, mealContext = 'main') {
  const nutrition = dish.estimatedNutrition;

  // Guard: no nutrition = neutral, no classification
  if (!nutrition) {
    dish.allergenFlags = [];
    dish.scoreBreakdown = null;
    return 50;
  }

  const adjustments = [];

  // ── Step 1: Allergen hard-block ───────────────────────────────────────────
  const allergenFlags = detectAllergens(dish);
  const userAllergies = userProfile.allergies || [];
  const hasAllergen = allergenFlags.some(a => userAllergies.includes(a));
  dish.allergenFlags = allergenFlags;
  if (hasAllergen) {
    dish.scoreBreakdown = { base: 50, adjustments: [{ reason: 'Contains allergen', delta: -50 }], final: 0 };
    return 0;
  }

  // ── Step 2: Personalised targets ─────────────────────────────────────────
  let tdee = userProfile.dailyCalories;
  if (!tdee || tdee === 2000) {
    const computed = calculateTDEE(userProfile);
    if (computed) tdee = computed;
    else tdee = 2000;
  }

  let targetCalories = tdee;
  if (userProfile.goal === 'lose_weight')  targetCalories = tdee * 0.80;
  if (userProfile.goal === 'build_muscle') targetCalories = tdee * 1.10;

  // Meal context multiplier (stub for future use)
  const mealTargetMultiplier = { breakfast: 0.25, main: 0.30, snack: 0.15, late_night: 0.20 };
  const mealCalorieTarget = targetCalories * (mealTargetMultiplier[mealContext] || 0.30);

  const bodyWeight = userProfile.weight || 70;
  const mealProteinTarget = bodyWeight * 0.35; // 0.3–0.4g/kg per meal midpoint

  // ── Step 3: Base score ────────────────────────────────────────────────────
  let score = 50;

  const goal    = userProfile.goal;
  const cal     = nutrition.calories?.avg || 0;
  const protein = nutrition.protein?.avg  || 0;
  const carbs   = nutrition.carbs?.avg    || 0;
  const fat     = nutrition.fat?.avg      || 0;
  const fiber   = nutrition.fiber         || 0;
  const method  = dish.cookingMethod      || 'unknown';
  const chars   = getDishCharacteristics(dish);

  // ── Step 4: Goal-based scoring ────────────────────────────────────────────

  if (goal === 'build_muscle') {
    // Protein is primary driver for muscle synthesis
    if (protein >= mealProteinTarget * 1.2)     { const d = +25; score += d; adjustments.push({ reason: 'Excellent protein for muscle building', delta: d }); }
    else if (protein >= mealProteinTarget)       { const d = +18; score += d; adjustments.push({ reason: 'Good protein for muscle building', delta: d }); }
    else if (protein >= mealProteinTarget * 0.7) { const d = +8;  score += d; adjustments.push({ reason: 'Moderate protein content', delta: d }); }
    else                                         { const d = -15; score += d; adjustments.push({ reason: 'Low protein — not ideal for muscle gain', delta: d }); }

    // Calories: need adequate fuel, but not excessive
    if (cal >= mealCalorieTarget * 0.9 && cal <= mealCalorieTarget * 1.4) { const d = +10; score += d; adjustments.push({ reason: 'Calories support muscle-building surplus', delta: d }); }
    else if (cal < mealCalorieTarget * 0.5) { const d = -8; score += d; adjustments.push({ reason: 'Too few calories for muscle gain', delta: d }); }

    // Cooking method — reduced penalty for fried since protein still wins
    if (['grilled', 'baked', 'roasted'].includes(method)) { const d = +8; score += d; adjustments.push({ reason: 'Grilled/baked — lean protein source', delta: d }); }
    else if (method === 'fried')                           { const d = -5; score += d; adjustments.push({ reason: 'Fried — adds unnecessary fat', delta: d }); }
  }

  else if (goal === 'lose_weight') {
    // Calories are the primary lever
    if (cal <= mealCalorieTarget * 0.7)      { const d = +22; score += d; adjustments.push({ reason: 'Well within calorie target', delta: d }); }
    else if (cal <= mealCalorieTarget)        { const d = +12; score += d; adjustments.push({ reason: 'Within calorie target', delta: d }); }
    else if (cal <= mealCalorieTarget * 1.2)  { const d = 0;   score += d; }
    else if (cal <= mealCalorieTarget * 1.5)  { const d = -15; score += d; adjustments.push({ reason: 'Significantly over calorie target', delta: d }); }
    else                                      { const d = -25; score += d; adjustments.push({ reason: 'Far exceeds calorie target', delta: d }); }

    // Protein preserves muscle during deficit
    if (protein >= 20)      { const d = +10; score += d; adjustments.push({ reason: 'Good protein preserves muscle during weight loss', delta: d }); }
    else if (protein >= 12) { const d = +5;  score += d; adjustments.push({ reason: 'Moderate protein content', delta: d }); }

    // Fiber = satiety (NIH PMC6360548, PMC6352252)
    if (fiber >= 6)      { const d = +10; score += d; adjustments.push({ reason: 'High fiber promotes fullness', delta: d }); }
    else if (fiber >= 3) { const d = +5;  score += d; adjustments.push({ reason: 'Good fiber for satiety', delta: d }); }

    // Fried is strongly penalised for weight loss
    if (method === 'fried')                                    { const d = -20; score += d; adjustments.push({ reason: 'Fried food — calorie-dense', delta: d }); }
    else if (['grilled', 'steamed', 'baked'].includes(method)) { const d = +8;  score += d; adjustments.push({ reason: 'Healthy cooking method', delta: d }); }

    // Low carb bonus
    if (carbs <= 15)      { const d = +8;  score += d; adjustments.push({ reason: 'Low carb — supports weight loss', delta: d }); }
    else if (carbs > 60)  { const d = -10; score += d; adjustments.push({ reason: 'High carbs — limit for weight loss', delta: d }); }
  }

  else if (goal === 'stay_healthy') {
    // Balanced macros — no extremes
    if (protein >= 15 && protein <= 50)                                    { const d = +10; score += d; adjustments.push({ reason: 'Good protein content', delta: d }); }
    if (cal >= mealCalorieTarget * 0.5 && cal <= mealCalorieTarget * 1.2)  { const d = +10; score += d; adjustments.push({ reason: 'Balanced calorie content', delta: d }); }
    if (fat <= 20)                                                          { const d = +5;  score += d; adjustments.push({ reason: 'Low fat content', delta: d }); }
    if (fiber >= 4)                                                         { const d = +6;  score += d; adjustments.push({ reason: 'Good fiber for overall health', delta: d }); }
    if (method === 'fried')                                                 { const d = -15; score += d; adjustments.push({ reason: 'Fried food — less healthy', delta: d }); }
    else if (['grilled', 'steamed', 'baked'].includes(method))             { const d = +8;  score += d; adjustments.push({ reason: 'Healthy cooking method', delta: d }); }
  }

  // ── Step 5: Diet type penalties ───────────────────────────────────────────
  const dietType = userProfile.dietType || [];
  if ((dietType.includes('vegetarian') || dietType.includes('vegan')) && containsMeat(dish)) {
    const d = -50; score += d; adjustments.push({ reason: 'Contains meat — not suitable for your diet', delta: d });
  }
  if (dietType.includes('vegan') && allergenFlags.includes('dairy')) {
    const d = -30; score += d; adjustments.push({ reason: 'Contains dairy — not suitable for vegan diet', delta: d });
  }
  if (dietType.includes('keto')) {
    if (carbs > 20)      { const d = -25; score += d; adjustments.push({ reason: 'High carbs — not keto-friendly', delta: d }); }
    else if (carbs <= 10){ const d = +15; score += d; adjustments.push({ reason: 'Very low carb — keto-friendly', delta: d }); }
  }
  if (dietType.includes('dairy_free') && allergenFlags.includes('dairy')) {
    const d = -30; score += d; adjustments.push({ reason: 'Contains dairy — not suitable for dairy-free diet', delta: d });
  }
  if (dietType.includes('gluten_free') && allergenFlags.includes('gluten')) {
    const d = -30; score += d; adjustments.push({ reason: 'Contains gluten — not suitable for gluten-free diet', delta: d });
  }

  // ── Step 6: Health condition scoring ─────────────────────────────────────
  const conditions = userProfile.healthConditions || [];
  const conditionNutrition = {
    fiber,
    satFat: nutrition.saturatedFat || 0,
    fat: nutrition.fat,
    protein: nutrition.protein,
    carbs: nutrition.carbs,
    calories: nutrition.calories,
  };
  const { delta: condDelta, reasons: condReasons } = applyConditionScoring(dish, conditions, conditionNutrition, chars);
  if (condDelta !== 0) {
    score += condDelta;
    condReasons.forEach(r => adjustments.push({ reason: r, delta: condDelta > 0 ? Math.abs(condDelta) : -Math.abs(condDelta) }));
  }

  // ── Step 7: Confidence adjustment ────────────────────────────────────────
  if (dish.confidenceScore < 65) {
    const d = -8; score += d;
    adjustments.push({ reason: 'Lower confidence AI estimate', delta: d });
  }

  const final = Math.max(0, Math.min(100, Math.round(score)));

  // Store score breakdown for UI "Why this score?" feature
  dish.scoreBreakdown = { base: 50, adjustments, final };

  return final;
}

// ── Tag generation ────────────────────────────────────────────────────────────

export function generateTags(dish, score) {
  const tags = [];
  const nutrition = dish.estimatedNutrition;
  if (!nutrition) return tags;

  const protein = nutrition.protein?.avg || 0;
  const carbs   = nutrition.carbs?.avg   || 0;
  const cal     = nutrition.calories?.avg || 0;
  const fiber   = nutrition.fiber        || 0;

  if (protein >= 25)  tags.push('High Protein');
  if (carbs   <= 15)  tags.push('Low Carb');
  if (cal     <= 350) tags.push('Low Calorie');
  if (cal     >= 700) tags.push('High Calorie');
  if (fiber   >= 5)   tags.push('High Fiber');
  if (['grilled', 'steamed', 'baked', 'roasted'].includes(dish.cookingMethod)) tags.push('Healthy Cook');
  if (dish.cookingMethod === 'fried') tags.push('Deep Fried');
  if (score >= 75)    tags.push('Fits Your Goal');

  return tags;
}

// ── Dish category detection for combo building ───────────────────────────────
// Uses LLM-provided category from extraction (primary)
// Falls back to keyword matching only if category is missing/unknown

const STARTER_KEYWORDS = [
  'soup', 'tikka', 'kebab', 'pakoda', 'pakora', 'samosa', 'roll', 'spring roll',
  'lollipop', 'lollypop', 'wings', 'drums', 'heaven', 'chaap', 'chaat', 'bhel',
  'manchurian', 'manchow', 'starter', 'appetizer', 'snack', 'kachori', 'vada',
  'cutlet', 'seekh', 'galouti', 'shammi', 'boti', 'hara bhara',
  'honey chilli', 'crispy corn',
];

const MAIN_KEYWORDS = [
  'biryani', 'pulao', 'curry', 'masala', 'dal', 'daal', 'makhani', 'korma',
  'rogan josh', 'kadhai', 'karahi', 'butter chicken', 'palak', 'saag',
  'thali', 'naan', 'roti', 'paratha', 'dosa', 'uttapam', 'idli', 'pongal',
  'khichdi', 'rajma', 'chana', 'chole', 'fried rice', 'noodles', 'hakka',
];

const DESSERT_DRINK_KEYWORDS = [
  'gulab jamun', 'rasgulla', 'jalebi', 'halwa', 'kheer', 'rasmalai', 'ladoo',
  'barfi', 'ice cream', 'kulfi', 'brownie', 'cake', 'dessert', 'sweet', 'payasam',
  'chai', 'tea', 'coffee', 'lassi', 'buttermilk', 'chaas', 'juice',
  'soda', 'water', 'sharbat', 'nimbu pani', 'smoothie', 'shake',
];

// Map LLM categories to combo roles
const LLM_CATEGORY_MAP = {
  starter:  'starter',
  main:     'main',
  dessert:  'dessert_drink',
  beverage: 'dessert_drink',
  bread:    'main',      // bread goes with main course
  rice:     'main',      // rice dishes are mains
  salad:    'starter',   // salads are starters
  other:    null,        // will fall back to keyword detection
};

function detectDishCategory(dish) {
  // Primary: use LLM-provided category
  const llmCategory = (dish.category || '').toLowerCase().trim();
  if (llmCategory && LLM_CATEGORY_MAP[llmCategory] !== undefined) {
    const mapped = LLM_CATEGORY_MAP[llmCategory];
    if (mapped !== null) return mapped;
    // mapped === null means 'other' — fall through to keyword detection
  }

  // Fallback: keyword matching
  const name = (dish.name || '').toLowerCase();
  const tags = (dish.tags || []).join(' ').toLowerCase();
  const text = name + ' ' + tags;

  if (DESSERT_DRINK_KEYWORDS.some(kw => text.includes(kw))) return 'dessert_drink';
  if (STARTER_KEYWORDS.some(kw => text.includes(kw))) return 'starter';
  if (MAIN_KEYWORDS.some(kw => text.includes(kw))) return 'main';

  // Last resort: calorie-based heuristic
  const cal = dish.estimatedNutrition?.calories?.avg || 0;
  if (cal < 200) return 'dessert_drink';
  if (cal < 400) return 'starter';
  return 'main';
}

/**
 * Build recommended meal combos from scored dishes.
 * Selects the best starter + main + dessert/drink combination
 * optimized for the user's goal.
 *
 * Logic:
 * - Only uses dishes with matchScore >= 45 (good or recommended tier)
 * - Picks top candidates per category by matchScore
 * - Validates combo against user's daily calorie target
 * - Returns up to 2 combos (best + runner-up with different main)
 */
export function buildRecommendedCombos(dishes, userProfile) {
  if (!dishes || dishes.length < 2) return [];

  // Calculate TDEE for combo validation
  let tdee = userProfile.dailyCalories || 2000;
  const goal = userProfile.goal;
  let targetCalories = tdee;
  if (goal === 'lose_weight')  targetCalories = tdee * 0.80;
  if (goal === 'build_muscle') targetCalories = tdee * 1.10;
  // A full meal (starter + main + dessert) should be 50-70% of daily target
  const comboCalMax = targetCalories * 0.70;
  const comboCalMin = targetCalories * 0.25; // at least 25% — avoid trivial combos

  const bodyWeight = userProfile.weight || 70;
  // For muscle building: combo should hit at least 0.5g/kg protein
  const comboProteinTarget = goal === 'build_muscle' ? bodyWeight * 0.5 : 0;

  // Filter to usable dishes (score >= 45, has nutrition)
  const usable = dishes.filter(d =>
    d.matchScore >= 45 &&
    d.estimatedNutrition?.calories?.avg != null
  );

  if (usable.length < 2) return [];

  // Categorize dishes
  const starters      = usable.filter(d => detectDishCategory(d) === 'starter').sort((a, b) => b.matchScore - a.matchScore);
  const mains         = usable.filter(d => detectDishCategory(d) === 'main').sort((a, b) => b.matchScore - a.matchScore);
  const dessertDrinks = usable.filter(d => detectDishCategory(d) === 'dessert_drink').sort((a, b) => b.matchScore - a.matchScore);

  // Need at least a main dish to build a combo
  if (mains.length === 0) return [];

  const combos = [];

  // Try to build combos with top 3 mains
  for (let mi = 0; mi < Math.min(3, mains.length); mi++) {
    const main = mains[mi];
    const mainCal = main.estimatedNutrition?.calories?.avg || 0;
    const mainProtein = main.estimatedNutrition?.protein?.avg || 0;

    // Pick best starter that fits calorie budget
    let starter = null;
    for (const s of starters) {
      const sCal = s.estimatedNutrition?.calories?.avg || 0;
      if (mainCal + sCal <= comboCalMax) {
        starter = s;
        break;
      }
    }

    // Pick best dessert/drink that fits remaining budget
    let dessertDrink = null;
    const usedCal = mainCal + (starter?.estimatedNutrition?.calories?.avg || 0);
    for (const d of dessertDrinks) {
      const dCal = d.estimatedNutrition?.calories?.avg || 0;
      if (usedCal + dCal <= comboCalMax) {
        dessertDrink = d;
        break;
      }
    }

    // Build combo — need at least main + one other
    const comboDishes = [starter, main, dessertDrink].filter(Boolean);
    if (comboDishes.length < 2) continue;

    // Calculate combined nutrition
    const totalCal     = comboDishes.reduce((s, d) => s + (d.estimatedNutrition?.calories?.avg || 0), 0);
    const totalProtein = comboDishes.reduce((s, d) => s + (d.estimatedNutrition?.protein?.avg  || 0), 0);
    const totalCarbs   = comboDishes.reduce((s, d) => s + (d.estimatedNutrition?.carbs?.avg    || 0), 0);
    const totalFat     = comboDishes.reduce((s, d) => s + (d.estimatedNutrition?.fat?.avg      || 0), 0);

    // Validate combo meets minimum thresholds
    if (totalCal < comboCalMin) continue;
    if (goal === 'build_muscle' && totalProtein < comboProteinTarget * 0.7) continue; // needs decent protein

    // Combo score = weighted average of component scores
    const comboScore = Math.round(
      comboDishes.reduce((s, d) => s + d.matchScore, 0) / comboDishes.length
    );

    // Generate combo label based on goal
    let comboLabel = '';
    if (goal === 'build_muscle') {
      comboLabel = totalProtein >= comboProteinTarget
        ? 'High Protein Meal'
        : 'Muscle Building Meal';
    } else if (goal === 'lose_weight') {
      comboLabel = totalCal <= targetCalories * 0.40 ? 'Light Meal' : 'Balanced Meal';
    } else {
      comboLabel = 'Balanced Meal';
    }

    combos.push({
      label: comboLabel,
      starter:      starter      ? { _id: starter._id,      name: starter.name,      matchScore: starter.matchScore }      : null,
      main:         main         ? { _id: main._id,          name: main.name,          matchScore: main.matchScore }          : null,
      dessertDrink: dessertDrink ? { _id: dessertDrink._id,  name: dessertDrink.name,  matchScore: dessertDrink.matchScore }  : null,
      totalCalories: Math.round(totalCal),
      totalProtein:  Math.round(totalProtein * 10) / 10,
      totalCarbs:    Math.round(totalCarbs   * 10) / 10,
      totalFat:      Math.round(totalFat     * 10) / 10,
      comboScore,
    });

    if (combos.length >= 2) break; // max 2 combos
  }

  return combos;
}

export function classifyDish(dish, userProfile = {}) {
  const score = dish.matchScore;
  const userAllergies = userProfile.allergies || [];

  // Only avoid if the dish contains an allergen the USER is actually allergic to
  const hasUserAllergen = (dish.allergenFlags || []).some(a => userAllergies.includes(a));
  if (hasUserAllergen) return 'avoid';

  if (score <= 25)  return 'avoid';
  if (score >= 65)  return 'recommended';
  if (score >= 45)  return 'good';
  return 'neutral';
}
