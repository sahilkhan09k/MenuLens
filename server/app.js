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

// CORS — allow credentials from the client origin
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      process.env.CLIENT_URL || 'http://localhost:5173',
      /^http:\/\/192\.168\.\d+\.\d+:5173$/,  // any LAN device
    ];
    if (!origin) return callback(null, true); // server-to-server / curl
    const ok = allowed.some(p => typeof p === 'string' ? p === origin : p.test(origin));
    ok ? callback(null, true) : callback(new Error(`CORS blocked: ${origin}`));
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
