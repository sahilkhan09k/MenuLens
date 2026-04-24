import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const GENDERS = [
  { value: 'male',   label: 'Male',   emoji: '👨' },
  { value: 'female', label: 'Female', emoji: '👩' },
  { value: 'other',  label: 'Other',  emoji: '🧑' },
];

function getOnboardingData() {
  try { return JSON.parse(sessionStorage.getItem('onboardingData') || '{}'); } catch { return {}; }
}

export default function OnboardingGenderAge() {
  const navigate = useNavigate();
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const data = getOnboardingData();
    if (data.gender) setGender(data.gender);
    if (data.age) setAge(String(data.age));
  }, []);

  const handleNext = () => {
    if (!gender) { setError('Please select your gender'); return; }
    const ageNum = Number(age);
    if (!age || isNaN(ageNum) || ageNum < 10 || ageNum > 120) {
      setError('Please enter a valid age (10–120)');
      return;
    }
    const data = getOnboardingData();
    sessionStorage.setItem('onboardingData', JSON.stringify({ ...data, gender, age: ageNum }));
    navigate('/onboarding/body');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col px-4 py-8 max-w-md mx-auto">
      {/* Progress */}
      <div className="mb-8">
        <p className="text-sm text-gray-500 mb-2">Step 1 of 7</p>
        <div className="flex gap-1">
          {[1,2,3,4,5,6,7].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${s === 1 ? 'bg-green-500' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>

      <motion.h1
        className="text-2xl font-bold text-gray-900 mb-1"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Tell us about yourself
      </motion.h1>
      <p className="text-gray-500 text-sm mb-6">This helps us personalize your recommendations</p>

      {/* Gender */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-3">Gender</label>
        <div className="flex gap-3">
          {GENDERS.map((g, i) => (
            <motion.button
              key={g.value}
              onClick={() => { setGender(g.value); setError(''); }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className={`flex-1 flex flex-col items-center py-4 rounded-2xl border-2 transition-colors ${
                gender === g.value ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'
              }`}
            >
              <span className="text-3xl mb-1">{g.emoji}</span>
              <span className={`text-sm font-medium ${gender === g.value ? 'text-green-700' : 'text-gray-700'}`}>
                {g.label}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Age */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Age</label>
        <div className="flex items-center gap-3 bg-white border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-green-400 transition-colors">
          <input
            type="number"
            min={10}
            max={120}
            value={age}
            onChange={e => { setAge(e.target.value); setError(''); }}
            placeholder="e.g. 25"
            className="flex-1 text-2xl font-bold text-gray-800 bg-transparent outline-none"
          />
          <span className="text-gray-400 font-medium">years</span>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <div className="mt-auto">
        <motion.button
          onClick={handleNext}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="w-full py-3 rounded-2xl font-semibold text-white bg-green-500 disabled:opacity-40 transition-opacity"
        >
          Next
        </motion.button>
      </div>
    </div>
  );
}
