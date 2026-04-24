import { motion } from 'framer-motion';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from '../components/LoadingScreen';

export default function Landing() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // While checking auth status, show loading screen
  if (loading) return <LoadingScreen />;

  // Already logged in and onboarded → go straight to home
  if (user && user.onboardingComplete) return <Navigate to="/home" replace />;

  // Logged in but onboarding not done → resume onboarding
  if (user && !user.onboardingComplete) return <Navigate to="/onboarding/gender-age" replace />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center px-4">
      <motion.div
        className="max-w-md w-full text-center text-white"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Logo / Title */}
        <div className="mb-4 flex justify-center">
          <span className="text-6xl">🍽️</span>
        </div>
        <h1 className="text-4xl font-bold mb-2">MenuLens</h1>
        <p className="text-xl font-medium mb-4 text-green-100">
          Scan any menu. Eat smarter.
        </p>

        {/* Description */}
        <p className="text-green-100 mb-10 leading-relaxed">
          Point your camera at any restaurant menu and instantly get personalized
          dish recommendations based on your dietary goals, allergies, and
          nutritional needs.
        </p>

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/signup')}
            className="w-full py-3 rounded-xl bg-white text-green-700 font-semibold text-lg shadow hover:bg-green-50 transition"
          >
            Get Started
          </button>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 rounded-xl border-2 border-white text-white font-semibold text-lg hover:bg-white/10 transition"
          >
            Sign In
          </button>
        </div>
      </motion.div>
    </div>
  );
}
