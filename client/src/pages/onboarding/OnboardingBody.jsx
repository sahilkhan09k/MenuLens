import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

function getOnboardingData() {
  try { return JSON.parse(sessionStorage.getItem('onboardingData') || '{}'); } catch { return {}; }
}

export default function OnboardingBody() {
  const navigate = useNavigate();
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [heightUnit, setHeightUnit] = useState('cm');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [error, setError] = useState('');

  useEffect(() => {
    const data = getOnboardingData();
    if (data.height) setHeight(String(data.height));
    if (data.weight) setWeight(String(data.weight));
  }, []);

  const handleNext = () => {
    const h = Number(height);
    const w = Number(weight);

    // Convert to cm/kg for storage
    const heightCm = heightUnit === 'ft' ? Math.round(h * 30.48) : h;
    const weightKg = weightUnit === 'lbs' ? Math.round(w * 0.453592) : w;

    if (!height || isNaN(h) || heightCm < 50 || heightCm > 300) {
      setError('Please enter a valid height');
      return;
    }
    if (!weight || isNaN(w) || weightKg < 20 || weightKg > 500) {
      setError('Please enter a valid weight');
      return;
    }

    const data = getOnboardingData();
    sessionStorage.setItem('onboardingData', JSON.stringify({ ...data, height: heightCm, weight: weightKg }));
    navigate('/onboarding/goal');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col px-4 py-8 max-w-md mx-auto">
      {/* Progress */}
      <div className="mb-8">
        <p className="text-sm text-gray-500 mb-2">Step 2 of 7</p>
        <div className="flex gap-1">
          {[1,2,3,4,5,6,7].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= 2 ? 'bg-green-500' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>

      <motion.h1
        className="text-2xl font-bold text-gray-900 mb-1"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Height & Weight
      </motion.h1>
      <p className="text-gray-500 text-sm mb-6">Used to calculate your nutritional needs</p>

      {/* Height */}
      <motion.div className="mb-5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-gray-700">Height</label>
          <div className="flex bg-gray-100 rounded-xl p-0.5">
            {['cm', 'ft'].map(u => (
              <button
                key={u}
                onClick={() => setHeightUnit(u)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${heightUnit === u ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-green-400 transition-colors">
          <input
            type="number"
            value={height}
            onChange={e => { setHeight(e.target.value); setError(''); }}
            placeholder={heightUnit === 'cm' ? 'e.g. 175' : 'e.g. 5.9'}
            className="flex-1 text-2xl font-bold text-gray-800 bg-transparent outline-none"
          />
          <span className="text-gray-400 font-medium">{heightUnit}</span>
        </div>
      </motion.div>

      {/* Weight */}
      <motion.div className="mb-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-gray-700">Weight</label>
          <div className="flex bg-gray-100 rounded-xl p-0.5">
            {['kg', 'lbs'].map(u => (
              <button
                key={u}
                onClick={() => setWeightUnit(u)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${weightUnit === u ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-green-400 transition-colors">
          <input
            type="number"
            value={weight}
            onChange={e => { setWeight(e.target.value); setError(''); }}
            placeholder={weightUnit === 'kg' ? 'e.g. 70' : 'e.g. 154'}
            className="flex-1 text-2xl font-bold text-gray-800 bg-transparent outline-none"
          />
          <span className="text-gray-400 font-medium">{weightUnit}</span>
        </div>
      </motion.div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <div className="mt-auto flex gap-3">
        <button
          onClick={() => navigate('/onboarding/gender-age')}
          className="flex-1 py-3 rounded-2xl font-semibold text-gray-700 bg-gray-100"
        >
          Back
        </button>
        <motion.button
          onClick={handleNext}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex-1 py-3 rounded-2xl font-semibold text-white bg-green-500 transition-opacity"
        >
          Next
        </motion.button>
      </div>
    </div>
  );
}
