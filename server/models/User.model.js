import mongoose from 'mongoose';

const { Schema } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true },
  email: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
    required: true,
  },
  password: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  otp: String,
  otpExpiry: Date,
  onboardingComplete: { type: Boolean, default: false },
  profile: {
    gender: { type: String, enum: ['male', 'female', 'other'] },
    age: { type: Number, min: 10, max: 120 },
    height: { type: Number, min: 50, max: 300 }, // cm
    weight: { type: Number, min: 20, max: 500 },  // kg
    activityLevel: {
      type: String,
      enum: ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active'],
    },
    goal: {
      type: String,
      enum: ['lose_weight', 'build_muscle', 'stay_healthy'],
    },
    dietType: [
      {
        type: String,
        enum: ['vegetarian', 'vegan', 'non_vegetarian', 'dairy_free', 'gluten_free', 'keto'],
      },
    ],
    allergies: [
      {
        type: String,
        enum: ['peanuts', 'shellfish', 'dairy', 'gluten', 'eggs', 'fish', 'tree_nuts', 'soy', 'none'],
      },
    ],
    dailyCalories: { type: Number, default: 2000, min: 1000, max: 5000 },
    healthConditions: [{
      type: String,
      enum: ['diabetes', 'hypertension', 'high_cholesterol', 'celiac_disease', 'ibs', 'gerd', 'kidney_disease', 'heart_disease', 'obesity', 'anemia', 'lactose_intolerance', 'none'],
    }],
    macros: {
      protein: { type: Number, default: 30 },
      carbs: { type: Number, default: 45 },
      fat: { type: Number, default: 25 },
    },
  },
  refreshToken: String,
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);

export default User;
