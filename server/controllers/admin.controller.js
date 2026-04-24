import FoodReviewQueue from '../models/FoodReviewQueue.model.js';
import FoodItem from '../models/FoodItem.model.js';
import Scan from '../models/Scan.model.js';
import User from '../models/User.model.js';

// ── Queue management ──────────────────────────────────────────────────────────

export async function getQueue(req, res) {
  try {
    const { status = 'pending', type, page = 1, limit = 20 } = req.query;
    const filter = { status };
    if (type) filter.entry_type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [items, total] = await Promise.all([
      FoodReviewQueue.find(filter)
        .sort({ priority_score: -1, first_seen_at: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      FoodReviewQueue.countDocuments(filter),
    ]);

    res.json({ items, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

export async function getQueueStats(req, res) {
  try {
    const [pending, reviewed, promoted, rejected, aiSourced, userFeedback] = await Promise.all([
      FoodReviewQueue.countDocuments({ status: 'pending' }),
      FoodReviewQueue.countDocuments({ status: 'reviewed' }),
      FoodReviewQueue.countDocuments({ status: 'promoted' }),
      FoodReviewQueue.countDocuments({ status: 'rejected' }),
      FoodReviewQueue.countDocuments({ entry_type: 'ai_sourced', status: 'pending' }),
      FoodReviewQueue.countDocuments({ entry_type: 'user_feedback', status: 'pending' }),
    ]);

    // Top pending dishes by priority
    const topPending = await FoodReviewQueue.find({ status: 'pending' })
      .sort({ priority_score: -1 })
      .limit(5)
      .select('dish_name entry_type scan_count priority_score ai_nutrition.confidence')
      .lean();

    res.json({ pending, reviewed, promoted, rejected, aiSourced, userFeedback, topPending });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

export async function updateQueueItem(req, res) {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    const item = await FoodReviewQueue.findByIdAndUpdate(
      id,
      { status, admin_notes, reviewed_at: new Date() },
      { new: true }
    );

    if (!item) return res.status(404).json({ message: 'Queue item not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

/**
 * Promote a queue item to FoodItem collection.
 * Admin provides corrected nutrition data.
 */
export async function promoteToFoodItem(req, res) {
  try {
    const { id } = req.params;
    const { nutrition, category, cooking_method, allergens, is_veg, admin_notes } = req.body;

    const queueItem = await FoodReviewQueue.findById(id);
    if (!queueItem) return res.status(404).json({ message: 'Queue item not found' });

    const canonicalName = queueItem.dish_name.toLowerCase().trim();

    // Upsert into FoodItem
    const foodItem = await FoodItem.findOneAndUpdate(
      { canonical_name: canonicalName },
      {
        $set: {
          canonical_name: canonicalName,
          display_name_en: queueItem.dish_name,
          category: category || 'other',
          cooking_method: cooking_method || 'unknown',
          allergens: allergens || [],
          is_veg: is_veg ?? true,
          data_source: 'admin_verified',
          data_quality_score: 85,
          verified: true,
          last_updated: new Date(),
          per_100g: nutrition?.per_100g || null,
          portions: nutrition?.portions || [],
          aliases: [{ alias_text: queueItem.dish_name, language: 'en', script: 'latin' }],
        },
      },
      { upsert: true, new: true }
    );

    // Mark queue item as promoted
    await FoodReviewQueue.findByIdAndUpdate(id, {
      status: 'promoted',
      admin_notes,
      reviewed_at: new Date(),
      promoted_to_food_item_id: foodItem._id,
    });

    res.json({ message: 'Promoted successfully', food_item: foodItem });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

// ── Dashboard stats ───────────────────────────────────────────────────────────

export async function getDashboardStats(req, res) {
  try {
    const [totalUsers, totalScans, totalFoodItems, queuePending] = await Promise.all([
      User.countDocuments(),
      Scan.countDocuments(),
      FoodItem.countDocuments(),
      FoodReviewQueue.countDocuments({ status: 'pending' }),
    ]);

    // Scans in last 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentScans = await Scan.countDocuments({ createdAt: { $gte: weekAgo } });

    // DB hit rate (dishes sourced from DB vs AI)
    const dbSourcedCount = await FoodItem.countDocuments({ data_source: { $in: ['IFCT_2017', 'INDB_ASC_Manual', 'INDB_2024', 'admin_verified'] } });

    res.json({
      totalUsers,
      totalScans,
      recentScans,
      totalFoodItems,
      queuePending,
      dbSourcedCount,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}
