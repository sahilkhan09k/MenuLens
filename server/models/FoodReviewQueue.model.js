import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * FoodReviewQueue — staging collection for admin review.
 *
 * Two entry types:
 * 1. 'ai_sourced'    — dish scanned from menu, not found in FoodItem DB, AI estimated nutrition
 * 2. 'user_feedback' — user flagged a dish as wrong/inaccurate
 *
 * Admin reviews daily, promotes verified entries to FoodItem collection.
 */
const foodReviewQueueSchema = new Schema({
  // Entry type
  entry_type: {
    type: String,
    enum: ['ai_sourced', 'user_feedback'],
    required: true,
    index: true,
  },

  // The dish name as extracted from the menu (normalized by LLM)
  dish_name: { type: String, required: true, index: true },

  // Raw name from menu (before LLM normalization)
  raw_name: String,

  // How many times this dish has been scanned (dedup key)
  scan_count: { type: Number, default: 1 },

  // AI-estimated nutrition (what we showed the user)
  ai_nutrition: {
    calories_min: Number,
    calories_max: Number,
    protein_min: Number,
    protein_max: Number,
    carbs_min: Number,
    carbs_max: Number,
    fat_min: Number,
    fat_max: Number,
    cooking_method: String,
    estimated_ingredients: [String],
    confidence: Number,
    recommend_reason: String,
    avoid_reasons: [String],
  },

  // User feedback (for user_feedback type)
  user_feedback: {
    feedback_type: {
      type: String,
      enum: ['wrong_nutrition', 'wrong_dish_name', 'missing_allergen', 'other'],
    },
    user_comment: String,
    user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    dish_id: { type: Schema.Types.ObjectId, ref: 'Dish' },
    scan_id: { type: Schema.Types.ObjectId, ref: 'Scan' },
  },

  // Priority score — higher = review first
  // Formula: (scan_count × 3) + (feedback_count × 5) + (low_confidence ? 10 : 0)
  priority_score: { type: Number, default: 0, index: true },

  // Admin review status
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'promoted', 'rejected', 'duplicate'],
    default: 'pending',
    index: true,
  },

  // Admin notes after review
  admin_notes: String,

  // If promoted — reference to the FoodItem created/updated
  promoted_to_food_item_id: { type: Schema.Types.ObjectId, ref: 'FoodItem' },

  // Timestamps
  first_seen_at: { type: Date, default: Date.now },
  last_seen_at: { type: Date, default: Date.now },
  reviewed_at: Date,
});

// Compound index for dedup lookup
foodReviewQueueSchema.index({ dish_name: 1, entry_type: 1 });

const FoodReviewQueue = mongoose.model('FoodReviewQueue', foodReviewQueueSchema);

export default FoodReviewQueue;
