import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/Navbar';
import { useScan } from '../context/ScanContext';
import api from '../utils/api';

const MESSAGES = [
  'Uploading images...',
  'Reading menu text...',
  'Analyzing nutrition...',
  'Scoring recommendations...',
];

// Error type → user-friendly message + tips
const ERROR_CONFIGS = {
  no_dishes_found: {
    emoji: '📷',
    title: "Couldn't read this menu",
    message: "We couldn't detect any dishes. This usually happens with dark, blurry, or handwritten menus.",
    tips: [
      'Move closer to the menu',
      'Ensure good lighting — avoid shadows',
      'Hold the camera steady',
      'Try a different angle',
    ],
    cta: 'Try Again',
  },
  generic: {
    emoji: '😕',
    title: 'Something went wrong',
    message: "We couldn't process your menu. Please try again.",
    tips: [],
    cta: 'Try Again',
  },
};

export default function Processing() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const { status, pollStatus } = useScan();
  const [msgIdx, setMsgIdx] = useState(0);
  const [errorType, setErrorType] = useState('generic');

  useEffect(() => {
    pollStatus(scanId);
  }, [scanId]);

  useEffect(() => {
    if (status === 'done') {
      navigate(`/results/${scanId}`, { replace: true });
    }
    // On error, the scan may have been deleted (pipeline failure cleans up)
    // Show generic error — no need to fetch the deleted scan
    if (status === 'error') {
      setErrorType('generic');
    }
  }, [status, scanId, navigate]);

  // Cycle messages every 3s
  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIdx(i => (i + 1) % MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  if (status === 'error') {
    const cfg = ERROR_CONFIGS[errorType] || ERROR_CONFIGS.generic;
    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
        <Navbar />
        <main className="pt-16 px-4 flex flex-col items-center justify-center min-h-[80vh] text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            <p className="text-6xl mb-4">{cfg.emoji}</p>
          </motion.div>

          <h2 className="text-xl font-bold text-gray-800 mb-2">{cfg.title}</h2>
          <p className="text-gray-500 text-sm mb-5 max-w-xs">{cfg.message}</p>

          {cfg.tips.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 text-left w-full max-w-xs">
              <p className="text-xs font-semibold text-gray-600 mb-2">Tips for a better scan:</p>
              <ul className="space-y-1.5">
                {cfg.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-500">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => navigate('/scan')}
            className="bg-green-500 hover:bg-green-600 text-white font-semibold px-8 py-3 rounded-2xl transition-colors w-full max-w-xs"
          >
            {cfg.cta}
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      <Navbar />
      <main className="pt-16 px-4 flex flex-col items-center justify-center min-h-[80vh]">
        {/* Pulsing dots */}
        <div className="flex gap-3 mb-8">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-4 h-4 bg-green-500 rounded-full"
              animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>

        <h2 className="text-xl font-bold text-gray-800 mb-3">Analyzing your menu</h2>

        <AnimatePresence mode="wait">
          <motion.p
            key={msgIdx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="text-gray-500 text-sm"
          >
            {MESSAGES[msgIdx]}
          </motion.p>
        </AnimatePresence>

        <p className="text-gray-300 text-xs mt-8">This may take up to 30 seconds</p>
      </main>
    </div>
  );
}
