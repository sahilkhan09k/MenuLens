import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import scanRoutes from './routes/scan.routes.js';
import dishRoutes from './routes/dish.routes.js';
import adminRoutes from './routes/admin.routes.js';
import feedbackRoutes from './routes/feedback.routes.js';

const app = express();

// CORS — in production, frontend proxies via Vercel so requests appear same-origin
// Only need to allow localhost for local development
app.use(cors({
  origin: (origin, callback) => {
    // Allow no-origin (server-to-server, curl) and localhost dev
    if (!origin || origin.startsWith('http://localhost') || origin.match(/^http:\/\/192\.168\.\d+\.\d+/)) {
      return callback(null, true);
    }
    // In production, Vercel proxy makes requests appear as same-origin — no CORS header needed
    // But allow the Vercel domain as fallback
    const clientUrl = (process.env.CLIENT_URL || '').replace(/\/$/, '');
    if (clientUrl && origin.replace(/\/$/, '') === clientUrl) {
      return callback(null, true);
    }
    callback(new Error('CORS blocked: ' + origin));
  },
  credentials: true,
}));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser
app.use(cookieParser());

// Route mounts
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/dish', dishRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/feedback', feedbackRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'MenuLens server is running' });
});

const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
});

export default app;
