import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const ALLERGIES = [
  { value: 'peanuts',    label: 'Peanuts' },
  { value: 'shellfish',  label: 'Shellfish' },
  { value: 'dairy',      label: 'Dairy' },
  { value: 'gluten',     label: 'Gluten' },
  { value: 'eggs',       label: 'Eggs' },
  { value: 'fish',       label: 'Fish' },
  { value: 'tree_nuts',  label: 'Tree Nuts' },
  { value: 'soy',        label: 'Soy' },
  { value: 'none',       label: 'None' },
];

function getOnboardingData() {
  try { return JSON.parse(sessionStorage.getItem('onboardingData') || '{}'); } catch { return {}; }
}

export default function OnboardingAllergies() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    const data = getOnboardingData();
    if (data.allergies) setSelected(data.allergies);
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

  const handleNext = () => {
    const data = getOnboardingData();
    sessionStorage.setItem('onboardingData', JSON.stringify({ ...data, allergies: selected }));
    navigate('/onboarding/activity');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col px-4 py-8 max-w-md mx-auto">
      {/* Progress */}
      <div className="mb-8">
        <p className="text-sm text-gray-500 mb-2">Step 5 of 7</p>
        <div className="flex gap-1">
          {[1,2,3,4,5,6,7].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= 5 ? 'bg-green-500' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>

      <motion.h1
        className="text-2xl font-bold text-gray-900 mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Any food allergies?
      </motion.h1>

      <div className="flex flex-wrap gap-3 flex-1 content-start">
        {ALLERGIES.map((allergy, i) => (
          <motion.button
            key={allergy.value}
            onClick={() => toggle(allergy.value)}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className={`px-4 py-2 rounded-full border-2 font-medium text-sm transition-colors ${
              selected.includes(allergy.value)
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-200 bg-white text-gray-700'
            }`}
          >
            {allergy.label}
          </motion.button>
        ))}
      </div>

      <div className="mt-8 flex gap-3">
        <button
          onClick={() => navigate('/onboarding/diet')}
          className="flex-1 py-3 rounded-2xl font-semibold text-gray-700 bg-gray-100"
        >
          Back
        </button>
        <motion.button
          onClick={handleNext}
          disabled={selected.length === 0}
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
