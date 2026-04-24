import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const CONDITIONS = [
  { value: 'diabetes',             label: 'Diabetes',              emoji: '🩸', desc: 'Requires low sugar, controlled carbs' },
  { value: 'hypertension',         label: 'Hypertension',          emoji: '💓', desc: 'Requires low sodium diet' },
  { value: 'high_cholesterol',     label: 'High Cholesterol',      emoji: '🫀', desc: 'Requires low saturated fat' },
  { value: 'celiac_disease',       label: 'Celiac Disease',        emoji: '🌾', desc: 'Strict gluten-free diet required' },
  { value: 'ibs',                  label: 'IBS',                   emoji: '🫃', desc: 'Sensitive to certain foods' },
  { value: 'gerd',                 label: 'GERD / Acid Reflux',    emoji: '🔥', desc: 'Avoid spicy, acidic, fatty foods' },
  { value: 'kidney_disease',       label: 'Kidney Disease',        emoji: '🫘', desc: 'Requires low potassium & phosphorus' },
  { value: 'heart_disease',        label: 'Heart Disease',         emoji: '❤️', desc: 'Low fat, low sodium diet' },
  { value: 'obesity',              label: 'Obesity',               emoji: '⚖️', desc: 'Calorie-controlled, nutrient-dense foods' },
  { value: 'anemia',               label: 'Anemia',                emoji: '🩺', desc: 'Requires iron-rich foods' },
  { value: 'lactose_intolerance',  label: 'Lactose Intolerance',   emoji: '🥛', desc: 'Avoid dairy products' },
  { value: 'none',                 label: 'None',                  emoji: '✅', desc: 'No health conditions' },
];

function getOnboardingData() {
  try { return JSON.parse(sessionStorage.getItem('onboardingData') || '{}'); } catch { return {}; }
}

export default function OnboardingConditions() {
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const data = getOnboardingData();
    if (data.healthConditions) setSelected(data.healthConditions);
  }, []);

  const toggle = (value) => {
    if (value === 'none') {
      setSelected(prev => prev.includes('none') ? [] : ['none']);
      return;
    }
    setSelected(prev => {
      const without = prev.filter(v => v !== 'none');
      return without.includes(value)
        ? without.filter(v => v !== value)
        : [...without, value];
    });
  };

  const handleComplete = async () => {
    if (selected.length === 0) {
      toast.error('Please select at least one option (or "None")');
      return;
    }

    const data = getOnboardingData();
    const payload = { ...data, healthConditions: selected };

    setLoading(true);
    try {
      const res = await api.put('/api/user/onboarding', payload);
      updateUser({ onboardingComplete: true, profile: res.data.user?.profile ?? payload });
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
        className="text-2xl font-bold text-gray-900 mb-1"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Any health conditions?
      </motion.h1>
      <p className="text-gray-500 text-sm mb-5">
        We'll factor these into your dish recommendations
      </p>

      <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
        {CONDITIONS.map((c, i) => (
          <motion.button
            key={c.value}
            onClick={() => toggle(c.value)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`w-full text-left px-4 py-3 rounded-2xl border-2 transition-colors flex items-center gap-3 ${
              selected.includes(c.value)
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <span className="text-xl">{c.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm ${selected.includes(c.value) ? 'text-green-700' : 'text-gray-900'}`}>
                {c.label}
              </p>
              <p className="text-xs text-gray-400 truncate">{c.desc}</p>
            </div>
            {selected.includes(c.value) && (
              <span className="text-green-500 text-lg shrink-0">✓</span>
            )}
          </motion.button>
        ))}
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate('/onboarding/activity')}
          className="flex-1 py-3 rounded-2xl font-semibold text-gray-700 bg-gray-100"
        >
          Back
        </button>
        <motion.button
          onClick={handleComplete}
          disabled={loading || selected.length === 0}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex-1 py-3 rounded-2xl font-semibold text-white bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {loading ? 'Saving…' : 'Complete Setup'}
        </motion.button>
      </div>
    </div>
  );
}
