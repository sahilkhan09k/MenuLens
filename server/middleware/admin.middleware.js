/**
 * Admin middleware — checks if the authenticated user is the admin.
 * Admin is identified by email matching ADMIN_EMAIL env var.
 * Must be used AFTER auth.middleware.js (protect).
 */
import User from '../models/User.model.js';

export async function adminOnly(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select('email');
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.warn('[admin] ADMIN_EMAIL not set in .env');
      return res.status(403).json({ message: 'Admin access not configured' });
    }

    if (user.email !== adminEmail.toLowerCase()) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    next();
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
}
