import mongoose from 'mongoose';

const { Schema } = mongoose;

const per100gSchema = new Schema(
  {
    calories_kcal: Number,
    protein_g: Number,
    carbs_g: Number,
    fat_g: Number,
    fiber_g: Number,
    sugar_g: Number,
    sodium_mg: Number,
    saturated_fat_g: Number,
  },
  { _id: false }
);

const portionSchema = new Schema(
  {
    label: String,
    weight_grams: Number,
    calories_kcal: Number,
    protein_g: Number,
    carbs_g: Number,
    fat_g: Number,
    fiber_g: Number,
    sugar_g: Number,
    sodium_mg: Number,
    saturated_fat_g: Number,
    is_default: { type: Boolean, default: false },
    tier: { type: String, enum: ['small', 'standard', 'large', 'home_recipe', 'single'], default: 'standard' },
    // Restaurant adjustment audit fields
    restaurant_multiplier_applied: Number,  // e.g. 1.5 for creamy curry
    multiplier_note: String,                // human-readable explanation shown in UI
  },
  { _id: false }
);

const aliasSchema = new Schema(
  {
    alias_text: { type: String, required: true },
    language: { type: String, default: 'en' }, // 'en', 'hi', 'te', 'ta', 'mr'
    script: { type: String, default: 'latin' }, // 'latin', 'devanagari', 'telugu', 'tamil'
  },
  { _id: false }
);

const foodItemSchema = new Schema({
  canonical_name: { type: String, required: true, unique: true, lowercase: true, trim: true },
  display_name_en: { type: String, required: true },
  display_name_hi: String,
  category: String,
  subcategory: String,
  cuisine_region: String,
  meal_type: String,
  cooking_method: {
    type: String,
    enum: ['grilled', 'fried', 'steamed', 'baked', 'raw', 'boiled', 'roasted', 'unknown'],
    default: 'unknown',
  },
  is_veg: { type: Boolean, default: true },
  is_vegan: { type: Boolean, default: false },
  is_jain: { type: Boolean, default: false },
  allergens: [String],
  glycemic_index: Number,
  data_source: { type: String, default: 'INDB_2024' },
  data_quality_score: { type: Number, default: 80 },
  verified: { type: Boolean, default: true },
  last_updated: { type: Date, default: Date.now },
  per_100g: per100gSchema,
  portions: [portionSchema],
  aliases: [aliasSchema],
});

// Indexes — canonical_name unique index is defined inline above
// Only add the text search index here
foodItemSchema.index(
  { display_name_en: 'text', 'aliases.alias_text': 'text' },
  { weights: { display_name_en: 10, 'aliases.alias_text': 5 } }
);

const FoodItem = mongoose.model('FoodItem', foodItemSchema);

export default FoodItem;
