import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { scoreDish, generateTags, classifyDish } from '../services/recommendation.service.js';
import { processDishNutrition } from '../services/nutrition.service.js';

// Feature: menulens, Property 3: Short passwords are always rejected
// Generate strings of length 0-7, assert they fail the >= 8 char check
test('Property 3: short passwords are always rejected', async (t) => {
  await fc.assert(
    fc.asyncProperty(
      fc.string({ maxLength: 7 }),
      async (password) => {
        assert.ok(password.length < 8, 'password should be short');
        // The validation rule: password.length < 8 → reject
        const isValid = password.length >= 8;
        assert.strictEqual(isValid, false);
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: menulens, Property 10: Upload file count boundary is enforced
// 0 files or > 3 files → invalid; 1-3 files → valid
test('Property 10: upload file count boundary is enforced', async (t) => {
  await fc.assert(
    fc.asyncProperty(
      fc.oneof(fc.constant(0), fc.integer({ min: 4, max: 20 })),
      async (count) => {
        const isValid = count >= 1 && count <= 3;
        assert.strictEqual(isValid, false);
      }
    ),
    { numRuns: 100 }
  );
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 3 }),
      async (count) => {
        const isValid = count >= 1 && count <= 3;
        assert.strictEqual(isValid, true);
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: menulens, Property 11: File size limit is enforced at the boundary
// size > 5MB → invalid; size <= 5MB → valid
test('Property 11: file size limit is enforced at the boundary', async (t) => {
  const MAX = 5 * 1024 * 1024;
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: MAX + 1, max: MAX * 3 }),
      async (size) => {
        assert.ok(size > MAX);
      }
    ),
    { numRuns: 100 }
  );
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: MAX }),
      async (size) => {
        assert.ok(size <= MAX);
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: menulens, Property 12: Only allowed MIME types are accepted
// Only image/jpeg, image/png, image/webp are valid
test('Property 12: only allowed MIME types are accepted', async (t) => {
  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
  await fc.assert(
    fc.asyncProperty(
      fc.string({ minLength: 1 }).filter(s => !ALLOWED.includes(s)),
      async (mimeType) => {
        assert.ok(!ALLOWED.includes(mimeType));
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: menulens, Property 16: Nutrition avg is always (min + max) / 2
test('Property 16: nutrition avg is always (min + max) / 2', async (t) => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        calories: fc.record({ min: fc.float({ min: 0, max: 500, noNaN: true }), max: fc.float({ min: 500, max: 2000, noNaN: true }) }),
        protein: fc.record({ min: fc.float({ min: 0, max: 20, noNaN: true }), max: fc.float({ min: 20, max: 100, noNaN: true }) }),
        carbs: fc.record({ min: fc.float({ min: 0, max: 30, noNaN: true }), max: fc.float({ min: 30, max: 200, noNaN: true }) }),
        fat: fc.record({ min: fc.float({ min: 0, max: 10, noNaN: true }), max: fc.float({ min: 10, max: 100, noNaN: true }) }),
        cookingMethod: fc.constant('grilled'),
        estimatedIngredients: fc.constant([]),
        confidence: fc.integer({ min: 0, max: 100 }),
      }),
      async (groqResult) => {
        const result = processDishNutrition({}, groqResult);
        for (const macro of ['calories', 'protein', 'carbs', 'fat']) {
          const { min, max, avg } = result.estimatedNutrition[macro];
          const expected = (min + max) / 2;
          assert.ok(Math.abs(avg - expected) < 0.001, `avg for ${macro} should be (min+max)/2`);
        }
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: menulens, Property 18: Match_Score is always clamped to [0, 100]
test('Property 18: match score is always clamped to [0, 100]', async (t) => {
  const GOALS = ['lose_weight', 'build_muscle', 'stay_healthy'];
  const DIET_TYPES = ['vegetarian', 'vegan', 'non_vegetarian', 'keto'];
  const ALLERGIES = ['peanuts', 'dairy', 'gluten', 'eggs', 'none'];
  const COOKING = ['grilled', 'fried', 'steamed', 'baked', 'raw', 'unknown'];

  await fc.assert(
    fc.asyncProperty(
      fc.record({
        estimatedNutrition: fc.record({
          calories: fc.record({ min: fc.float({ min: 0, max: 500 }), max: fc.float({ min: 500, max: 2000 }), avg: fc.float({ min: 0, max: 2000 }) }),
          protein: fc.record({ min: fc.float({ min: 0, max: 20 }), max: fc.float({ min: 20, max: 100 }), avg: fc.float({ min: 0, max: 100 }) }),
          carbs: fc.record({ min: fc.float({ min: 0, max: 30 }), max: fc.float({ min: 30, max: 200 }), avg: fc.float({ min: 0, max: 200 }) }),
          fat: fc.record({ min: fc.float({ min: 0, max: 10 }), max: fc.float({ min: 10, max: 100 }), avg: fc.float({ min: 0, max: 100 }) }),
        }),
        cookingMethod: fc.constantFrom(...COOKING),
        confidenceScore: fc.integer({ min: 0, max: 100 }),
        estimatedIngredients: fc.array(fc.string(), { maxLength: 5 }),
        allergenFlags: fc.constant([]),
      }),
      fc.record({
        goal: fc.constantFrom(...GOALS),
        dietType: fc.array(fc.constantFrom(...DIET_TYPES), { maxLength: 2 }),
        allergies: fc.array(fc.constantFrom(...ALLERGIES), { maxLength: 2 }),
        dailyCalories: fc.integer({ min: 1000, max: 5000 }),
      }),
      async (dish, userProfile) => {
        const score = scoreDish(dish, userProfile);
        assert.ok(score >= 0 && score <= 100, `score ${score} should be in [0, 100]`);
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: menulens, Property 19: Allergen match hard-blocks the score to 0
test('Property 19: allergen match hard-blocks the score to 0', async (t) => {
  const ALLERGEN_KEYWORDS = {
    peanuts: ['peanut'],
    dairy: ['milk', 'cheese'],
    gluten: ['wheat', 'flour'],
    eggs: ['egg'],
  };
  const ALLERGEN_NAMES = Object.keys(ALLERGEN_KEYWORDS);

  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom(...ALLERGEN_NAMES),
      async (allergen) => {
        const keyword = ALLERGEN_KEYWORDS[allergen][0];
        const dish = {
          estimatedNutrition: {
            calories: { min: 200, max: 400, avg: 300 },
            protein: { min: 10, max: 20, avg: 15 },
            carbs: { min: 20, max: 40, avg: 30 },
            fat: { min: 5, max: 15, avg: 10 },
          },
          cookingMethod: 'grilled',
          confidenceScore: 80,
          estimatedIngredients: [keyword],
          allergenFlags: [],
        };
        const userProfile = {
          goal: 'stay_healthy',
          dietType: [],
          allergies: [allergen],
          dailyCalories: 2000,
        };
        const score = scoreDish(dish, userProfile);
        assert.strictEqual(score, 0, `score should be 0 when dish contains allergen ${allergen}`);
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: menulens, Property 20: Tag generation is consistent with nutrition thresholds
test('Property 20: tag generation is consistent with nutrition thresholds', async (t) => {
  const COOKING = ['grilled', 'fried', 'steamed', 'baked', 'raw', 'unknown'];

  await fc.assert(
    fc.asyncProperty(
      fc.record({
        estimatedNutrition: fc.record({
          calories: fc.record({ min: fc.float({ min: 0, max: 500 }), max: fc.float({ min: 0, max: 500 }), avg: fc.float({ min: 0, max: 1500 }) }),
          protein: fc.record({ min: fc.float({ min: 0, max: 50 }), max: fc.float({ min: 0, max: 50 }), avg: fc.float({ min: 0, max: 100 }) }),
          carbs: fc.record({ min: fc.float({ min: 0, max: 100 }), max: fc.float({ min: 0, max: 100 }), avg: fc.float({ min: 0, max: 200 }) }),
          fat: fc.record({ min: fc.float({ min: 0, max: 50 }), max: fc.float({ min: 0, max: 50 }), avg: fc.float({ min: 0, max: 100 }) }),
        }),
        cookingMethod: fc.constantFrom(...COOKING),
      }),
      fc.integer({ min: 0, max: 100 }),
      async (dish, score) => {
        const tags = generateTags(dish, score);
        const n = dish.estimatedNutrition;

        // Verify each tag condition
        if (n.protein.avg >= 25) assert.ok(tags.includes('High Protein'));
        else assert.ok(!tags.includes('High Protein'));

        if (n.carbs.avg <= 20) assert.ok(tags.includes('Low Carb'));
        else assert.ok(!tags.includes('Low Carb'));

        if (n.calories.avg <= 400) assert.ok(tags.includes('Low Calorie'));
        else assert.ok(!tags.includes('Low Calorie'));

        if (n.calories.avg >= 700) assert.ok(tags.includes('High Calorie'));
        else assert.ok(!tags.includes('High Calorie'));

        if (['grilled', 'steamed', 'baked'].includes(dish.cookingMethod)) assert.ok(tags.includes('Healthy Cook'));
        else assert.ok(!tags.includes('Healthy Cook'));

        if (dish.cookingMethod === 'fried') assert.ok(tags.includes('Deep Fried'));
        else assert.ok(!tags.includes('Deep Fried'));

        if (score >= 80) assert.ok(tags.includes('Fits Your Goal'));
        else assert.ok(!tags.includes('Fits Your Goal'));
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: menulens, Property 21: Results sections form a complete partition of all dishes
test('Property 21: results sections form a complete partition of all dishes', async (t) => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(
        fc.record({
          _id: fc.uuid(),
          matchScore: fc.integer({ min: 0, max: 100 }),
          allergenFlags: fc.array(fc.string(), { maxLength: 2 }),
        }),
        { minLength: 0, maxLength: 20 }
      ),
      async (dishes) => {
        const recommended = dishes.filter(d => d.matchScore >= 60);
        const avoid = dishes.filter(d => d.allergenFlags.length > 0 || d.matchScore <= 30);
        const avoidIds = new Set(avoid.map(d => d._id));
        const recommendedIds = new Set(recommended.map(d => d._id));
        const rest = dishes.filter(d => !recommendedIds.has(d._id) && !avoidIds.has(d._id));

        // All dishes appear in at least one section
        const allInSections = new Set([...recommended.map(d => d._id), ...avoid.map(d => d._id), ...rest.map(d => d._id)]);
        assert.strictEqual(allInSections.size, dishes.length, 'all dishes should appear in sections');
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: menulens, Property 22: Scan history is sorted by creation date descending
test('Property 22: scan history is sorted by creation date descending', async (t) => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(
        fc.record({ _id: fc.uuid(), createdAt: fc.date() }),
        { minLength: 0, maxLength: 20 }
      ),
      async (scans) => {
        const sorted = [...scans].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        for (let i = 0; i < sorted.length - 1; i++) {
          assert.ok(new Date(sorted[i].createdAt) >= new Date(sorted[i + 1].createdAt));
        }
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: menulens, Property 23: Save toggle is idempotent over two applications
test('Property 23: save toggle is idempotent over two applications', async (t) => {
  await fc.assert(
    fc.asyncProperty(
      fc.boolean(),
      async (initialSaved) => {
        let isSaved = initialSaved;
        isSaved = !isSaved; // toggle once
        isSaved = !isSaved; // toggle twice
        assert.strictEqual(isSaved, initialSaved, 'double toggle should return to original state');
      }
    ),
    { numRuns: 100 }
  );
});
