import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const GOALS = [
  { value: 'lose_weight',  label: 'Lose Weight',  emoji: '⚖️', desc: 'Reduce calorie intake and avoid high-fat foods' },
  { value: 'build_muscle', label: 'Build Muscle', emoji: '💪', desc: 'Prioritize high-protein dishes' },
  { value: 'stay_healthy', label: 'Stay Healthy', emoji: '🥗', desc: 'Balanced nutrition for overall wellness' },
];

function getOnboardingData() {
  try { return JSON.parse(sessionStorage.getItem('onboardingData') || '{}'); } catch { return {}; }
}

export default function OnboardingGoal() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState('');

  useEffect(() => {
    const data = getOnboardingData();
    if (data.goal) setSelected(data.goal);
  }, []);

  const handleNext = () => {
    if (!selected) return;
    const data = getOnboardingData();
    sessionStorage.setItem('onboardingData', JSON.stringify({ ...data, goal: selected }));
    navigate('/onboarding/diet');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col px-4 py-8 max-w-md mx-auto">
      <div className="mb-8">
        <p className="text-sm text-gray-500 mb-2">Step 3 of 7</p>
        <div className="flex gap-1">
          {[1,2,3,4,5,6,7].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= 3 ? 'bg-green-500' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>

      <motion.h1 className="text-2xl font-bold text-gray-900 mb-6" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        What's your health goal?
      </motion.h1>

      <div className="flex flex-col gap-3 flex-1">
        {GOALS.map((goal, i) => (
          <motion.button
            key={goal.value}
            onClick={() => setSelected(goal.value)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className={`w-full text-left p-4 rounded-2xl border-2 transition-colors ${selected === goal.value ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{goal.emoji}</span>
              <div>
                <p className="font-semibold text-gray-900">{goal.label}</p>
                <p className="text-sm text-gray-500">{goal.desc}</p>
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      <div className="mt-8 flex gap-3">
        <button onClick={() => navigate('/onboarding/body')} className="flex-1 py-3 rounded-2xl font-semibold text-gray-700 bg-gray-100">
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
