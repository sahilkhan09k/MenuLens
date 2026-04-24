import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const ACTIVITIES = [
  { value: 'sedentary',         label: 'Sedentary',          emoji: '🛋️', desc: 'Little or no exercise, desk job' },
  { value: 'lightly_active',    label: 'Lightly Active',     emoji: '🚶', desc: 'Light exercise 1–3 days/week' },
  { value: 'moderately_active', label: 'Moderately Active',  emoji: '🏃', desc: 'Moderate exercise 3–5 days/week' },
  { value: 'very_active',       label: 'Very Active',        emoji: '🏋️', desc: 'Hard exercise 6–7 days/week' },
  { value: 'extra_active',      label: 'Extra Active',       emoji: '⚡', desc: 'Very hard exercise, physical job' },
];

function getOnboardingData() {
  try { return JSON.parse(sessionStorage.getItem('onboardingData') || '{}'); } catch { return {}; }
}

export default function OnboardingActivity() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState('');

  useEffect(() => {
    const data = getOnboardingData();
    if (data.activityLevel) setSelected(data.activityLevel);
  }, []);

  const handleNext = () => {
    if (!selected) return;
    const data = getOnboardingData();
    sessionStorage.setItem('onboardingData', JSON.stringify({ ...data, activityLevel: selected }));
    navigate('/onboarding/conditions');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col px-4 py-8 max-w-md mx-auto">
      {/* Progress */}
      <div className="mb-8">
        <p className="text-sm text-gray-500 mb-2">Step 6 of 7</p>
        <div className="flex gap-1">
          {[1,2,3,4,5,6,7].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= 6 ? 'bg-green-500' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>

      <motion.h1
        className="text-2xl font-bold text-gray-900 mb-1"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Activity Level
      </motion.h1>
      <p className="text-gray-500 text-sm mb-6">How active are you on a typical week?</p>

      <div className="flex flex-col gap-3 flex-1">
        {ACTIVITIES.map((a, i) => (
          <motion.button
            key={a.value}
            onClick={() => setSelected(a.value)}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className={`w-full text-left p-4 rounded-2xl border-2 transition-colors ${
              selected === a.value ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{a.emoji}</span>
              <div>
                <p className={`font-semibold ${selected === a.value ? 'text-green-700' : 'text-gray-900'}`}>
                  {a.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{a.desc}</p>
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate('/onboarding/allergies')}
          className="flex-1 py-3 rounded-2xl font-semibold text-gray-700 bg-gray-100"
        >
          Back
        </button>
        <motion.button
          onClick={handleNext}
          disabled={!selected}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex-1 py-3 rounded-2xl font-semibold text-white bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          Next
        </motion.button>
      </div>
    </div>
  );
}
