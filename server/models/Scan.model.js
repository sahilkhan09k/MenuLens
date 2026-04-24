import mongoose from 'mongoose';

const { Schema } = mongoose;

const scanSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  restaurantName: String,
  restaurantLocation: {
    lat: Number,
    lng: Number,
    address: String,      // reverse-geocoded address from Google Places
    placeId: String,      // Google Place ID for future use
  },
  images: [String],
  imageHashes: [String],
  rawExtractedText: String,
  status: {
    type: String,
    enum: ['processing', 'complete', 'failed'],
    default: 'processing',
  },
  errorMessage: String,
  // Scan quality assessment
  scanQuality: {
    type: String,
    enum: ['good', 'partial', 'low_confidence', 'unreadable'],
    default: 'good',
  },
  scanQualityNote: String,
  dishes: [{ type: Schema.Types.ObjectId, ref: 'Dish' }],
  recommendedDishes: [{ type: Schema.Types.ObjectId, ref: 'Dish' }],
  avoidDishes: [{ type: Schema.Types.ObjectId, ref: 'Dish' }],
  totalDishesFound: { type: Number, default: 0 },
  totalMatchingDishes: { type: Number, default: 0 },
  totalFlaggedDishes: { type: Number, default: 0 },
  isSaved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const Scan = mongoose.model('Scan', scanSchema);

export default Scan;
