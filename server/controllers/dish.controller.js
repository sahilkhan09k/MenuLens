import Dish from '../models/Dish.model.js';

export async function getDish(req, res) {
  try {
    const dish = await Dish.findById(req.params.dishId).populate('scanId');

    if (!dish) return res.status(404).json({ message: 'Dish not found.' });

    // Verify ownership via the populated scan
    if (dish.scanId.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden.' });
    }

    res.json(dish);
  } catch (err) {
    console.error('[dish] getDish error:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
}

export async function toggleSaveDish(req, res) {
  try {
    const dish = await Dish.findById(req.params.dishId).populate('scanId', 'userId restaurantName');
    if (!dish) return res.status(404).json({ message: 'Dish not found.' });
    if (dish.scanId?.userId?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden.' });
    }

    dish.isSaved = !dish.isSaved;
    dish.savedAt = dish.isSaved ? new Date() : null;
    // Denormalize restaurant name onto the dish so it persists even if Scan is later deleted
    if (dish.isSaved && dish.scanId?.restaurantName) {
      dish.restaurantName = dish.scanId.restaurantName;
    }
    await dish.save();

    res.json({ isSaved: dish.isSaved, restaurantName: dish.restaurantName || null });
  } catch (err) {
    console.error('[dish] toggleSaveDish error:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
}

export async function getSavedDishes(req, res) {
  try {
    // Scope the query to the current user's scans from the start — no post-filter needed
    const dishes = await Dish.find({ isSaved: true })
      .populate({
        path: 'scanId',
        match: { userId: req.user.id },
        select: 'restaurantName createdAt userId',
      })
      .sort({ savedAt: -1 })
      .lean();

    // populate match sets scanId to null for non-matching docs — filter those out
    const userDishes = dishes.filter(d => d.scanId != null);

    res.json({ dishes: userDishes });
  } catch (err) {
    console.error('[dish] getSavedDishes error:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
}
