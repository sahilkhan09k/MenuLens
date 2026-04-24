import mongoose from 'mongoose';

const { Schema } = mongoose;

const macroRangeSchema = new Schema(
  {
    min: Number,
    max: Number,
    avg: Number,
  },
  { _id: false }
);

const dishSchema = new Schema({
  scanId: {
    type: Schema.Types.ObjectId,
    ref: 'Scan',
    required: true,
    index: true,
  },
  name: String,
  description: String,
  estimatedNutrition: {
    calories: macroRangeSchema,
    protein: macroRangeSchema,
    carbs: macroRangeSchema,
    fat: macroRangeSchema,
    fiber: Number,
    sugar: Number,
  },
  confidenceScore: { type: Number, default: 0, min: 0, max: 100 },
  matchScore: { type: Number, default: 0, min: 0, max: 100 },
  tags: [String],
  allergenFlags: [String],
  avoidReasons: [String],
  recommendReason: String,
  cookingMethod: {
    type: String,
    enum: ['grilled', 'fried', 'steamed', 'baked', 'raw', 'boiled', 'roasted', 'stir-fried', 'unknown'],
    default: 'unknown',
  },
  estimatedPrice: Number,
  dataSource: { type: String, enum: ['database', 'ai'], default: 'ai' },
  multiplierNote: String,
  // Score breakdown — stored for "Why this score?" UI feature
  scoreBreakdown: {
    base: Number,
    adjustments: [{ reason: String, delta: Number, _id: false }],
    final: Number,
  },
  // Dish-level save — user bookmarks individual dishes
  isSaved: { type: Boolean, default: false },
  savedAt: Date,
  // All three portion tiers from DB (small/standard/large) — used by UI picker
  portionTiers: {
    small:    { label: String, weight_grams: Number, calories_kcal: Number, protein_g: Number, carbs_g: Number, fat_g: Number },
    standard: { label: String, weight_grams: Number, calories_kcal: Number, protein_g: Number, carbs_g: Number, fat_g: Number },
    large:    { label: String, weight_grams: Number, calories_kcal: Number, protein_g: Number, carbs_g: Number, fat_g: Number },
  },
  createdAt: { type: Date, default: Date.now },
});

const Dish = mongoose.model('Dish', dishSchema);

export default Dish;
