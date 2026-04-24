import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

function getOnboardingData() {
  try { return JSON.parse(sessionStorage.getItem('onboardingData') || '{}'); } catch { return {}; }
}

export default function OnboardingCalories() {
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [calories, setCalories] = useState(2000);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const data = getOnboardingData();
    if (data.dailyCalories) setCalories(data.dailyCalories);
  }, []);

  const handleComplete = async () => {
    const data = getOnboardingData();
    const payload = { ...data, dailyCalories: calories };

    setLoading(true);
    try {
      const res = await api.put('/api/user/onboarding', payload);
      updateUser({ onboardingComplete: true, profile: res.data.profile ?? payload });
      sessionStorage.removeItem('onboardingData');
      navigate('/onboarding/complete');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col px-4 py-8 max-w-md mx-auto">
      {/* Progress */}
      <div className="mb-8">
        <p className="text-sm text-gray-500 mb-2">Step 7 of 7</p>
        <div className="flex gap-1">
          {[1,2,3,4,5,6,7].map(s => (
            <div key={s} className="h-1.5 flex-1 rounded-full bg-green-500" />
          ))}
        </div>
      </div>

      <motion.h1
        className="text-2xl font-bold text-gray-900 mb-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Daily calorie target?
      </motion.h1>

      <p className="text-sm text-gray-500 mb-8">Typical adult needs 1500–2500 kcal/day</p>

      <motion.div
        className="bg-white rounded-2xl p-6 border border-gray-200 flex flex-col items-center gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1000}
            max={5000}
            value={calories}
            onChange={e => setCalories(Math.min(5000, Math.max(1000, Number(e.target.value))))}
            className="w-32 text-center text-3xl font-bold text-green-600 border-b-2 border-green-400 bg-transparent outline-none py-1"
          />
          <span className="text-gray-500 font-medium">kcal</span>
        </div>
        <input
          type="range"
          min={1000}
          max={5000}
          step={50}
          value={calories}
          onChange={e => setCalories(Number(e.target.value))}
          className="w-full accent-green-500"
        />
        <div className="flex justify-between w-full text-xs text-gray-400">
          <span>1000</span>
          <span>5000</span>
        </div>
      </motion.div>

      <div className="mt-8 flex gap-3">
        <button
          onClick={() => navigate('/onboarding/activity')}
          className="flex-1 py-3 rounded-2xl font-semibold text-gray-700 bg-gray-100"
        >
          Back
        </button>
        <motion.button
          onClick={handleComplete}
          disabled={loading}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex-1 py-3 rounded-2xl font-semibold text-white bg-green-500 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
        >
          {loading ? 'Saving…' : 'Complete Setup'}
        </motion.button>
      </div>
    </div>
  );
}
