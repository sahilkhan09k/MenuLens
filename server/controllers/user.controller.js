import User from '../models/User.model.js';
import Scan from '../models/Scan.model.js';
import Dish from '../models/Dish.model.js';

const VALID_GOALS = ['lose_weight', 'build_muscle', 'stay_healthy'];
const VALID_DIET_TYPES = ['vegetarian', 'vegan', 'non_vegetarian', 'dairy_free', 'gluten_free', 'keto'];
const VALID_ALLERGIES = ['peanuts', 'shellfish', 'dairy', 'gluten', 'eggs', 'fish', 'tree_nuts', 'soy', 'none'];
const VALID_GENDERS = ['male', 'female', 'other'];
const VALID_ACTIVITY = ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active'];
const VALID_CONDITIONS = ['diabetes', 'hypertension', 'high_cholesterol', 'celiac_disease', 'ibs', 'gerd', 'kidney_disease', 'heart_disease', 'obesity', 'anemia', 'lactose_intolerance', 'none'];

function validateProfileFields(body) {
  const invalid = [];

  if (body.gender !== undefined && !VALID_GENDERS.includes(body.gender)) invalid.push('gender');
  if (body.age !== undefined) {
    const age = Number(body.age);
    if (!Number.isInteger(age) || age < 10 || age > 120) invalid.push('age');
  }
  if (body.height !== undefined) {
    const h = Number(body.height);
    if (isNaN(h) || h < 50 || h > 300) invalid.push('height');
  }
  if (body.weight !== undefined) {
    const w = Number(body.weight);
    if (isNaN(w) || w < 20 || w > 500) invalid.push('weight');
  }
  if (body.activityLevel !== undefined && !VALID_ACTIVITY.includes(body.activityLevel)) invalid.push('activityLevel');
  if (body.goal !== undefined && !VALID_GOALS.includes(body.goal)) invalid.push('goal');
  if (body.dietType !== undefined) {
    if (!Array.isArray(body.dietType) || body.dietType.some(d => !VALID_DIET_TYPES.includes(d))) invalid.push('dietType');
  }
  if (body.allergies !== undefined) {
    if (!Array.isArray(body.allergies) || body.allergies.some(a => !VALID_ALLERGIES.includes(a))) invalid.push('allergies');
  }
  if (body.healthConditions !== undefined) {
    if (!Array.isArray(body.healthConditions) || body.healthConditions.some(c => !VALID_CONDITIONS.includes(c))) invalid.push('healthConditions');
  }

  return invalid;
}

export async function getProfile(req, res) {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -otp -otpExpiry -refreshToken');

    if (!user) return res.status(404).json({ message: 'User not found.' });

    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
}

export async function updateProfile(req, res) {
  try {
    const { name, gender, age, height, weight, activityLevel, goal, dietType, allergies, healthConditions } = req.body;

    const invalid = validateProfileFields({ gender, age, height, weight, activityLevel, goal, dietType, allergies, healthConditions });
    if (invalid.length) {
      return res.status(400).json({ message: 'Invalid fields.', invalidFields: invalid });
    }

    const update = {};
    if (name !== undefined) update.name = name;
    if (gender !== undefined) update['profile.gender'] = gender;
    if (age !== undefined) update['profile.age'] = Number(age);
    if (height !== undefined) update['profile.height'] = Number(height);
    if (weight !== undefined) update['profile.weight'] = Number(weight);
    if (activityLevel !== undefined) update['profile.activityLevel'] = activityLevel;
    if (goal !== undefined) update['profile.goal'] = goal;
    if (dietType !== undefined) update['profile.dietType'] = dietType;
    if (allergies !== undefined) update['profile.allergies'] = allergies;
    if (healthConditions !== undefined) update['profile.healthConditions'] = healthConditions;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true, runValidators: true }
    ).select('-password -otp -otpExpiry -refreshToken');

    if (!user) return res.status(404).json({ message: 'User not found.' });

    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
}

export async function completeOnboarding(req, res) {
  try {
    const { gender, age, height, weight, activityLevel, goal, dietType, allergies, healthConditions } = req.body;

    const invalid = validateProfileFields({ gender, age, height, weight, activityLevel, goal, dietType, allergies, healthConditions });
    if (invalid.length) {
      return res.status(400).json({ message: 'Invalid fields.', invalidFields: invalid });
    }

    const update = { onboardingComplete: true };
    if (gender !== undefined) update['profile.gender'] = gender;
    if (age !== undefined) update['profile.age'] = Number(age);
    if (height !== undefined) update['profile.height'] = Number(height);
    if (weight !== undefined) update['profile.weight'] = Number(weight);
    if (activityLevel !== undefined) update['profile.activityLevel'] = activityLevel;
    if (goal !== undefined) update['profile.goal'] = goal;
    if (dietType !== undefined) update['profile.dietType'] = dietType;
    if (allergies !== undefined) update['profile.allergies'] = allergies;
    if (healthConditions !== undefined) update['profile.healthConditions'] = healthConditions;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true, runValidators: true }
    ).select('-password -otp -otpExpiry -refreshToken');

    if (!user) return res.status(404).json({ message: 'User not found.' });

    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
}

export async function deleteAccount(req, res) {
  try {
    const scans = await Scan.find({ userId: req.user.id }).select('_id');
    const scanIds = scans.map(s => s._id);

    await Dish.deleteMany({ scanId: { $in: scanIds } });
    await Scan.deleteMany({ userId: req.user.id });
    await User.findByIdAndDelete(req.user.id);

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.status(200).json({ message: 'Account deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
}
