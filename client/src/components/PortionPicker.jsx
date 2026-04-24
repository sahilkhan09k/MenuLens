import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * PortionPicker — shows a small/standard/large selector when a dish has DB-sourced portion tiers.
 * For AI-estimated dishes (no tiers), shows nothing (single estimate only).
 *
 * Props:
 *   dish        — the dish object from the scan results
 *   onSelect    — callback(tier, nutrition) when user picks a tier
 *   onClose     — callback when dismissed
 */
export default function PortionPicker({ dish, onSelect, onClose }) {
  const tiers = dish?.portionTiers;
  const [selected, setSelected] = useState('standard');

  // If no tiers (AI-estimated dish), don't render
  if (!tiers || (!tiers.small && !tiers.standard && !tiers.large)) return null;

  const options = [
    tiers.small    && { tier: 'small',    ...tiers.small    },
    tiers.standard && { tier: 'standard', ...tiers.standard },
    tiers.large    && { tier: 'large',    ...tiers.large    },
  ].filter(Boolean);

  const selectedOption = options.find((o) => o.tier === selected) || options[0];

  const handleConfirm = () => {
    onSelect?.(selected, selectedOption);
    onClose?.();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white rounded-2xl w-full max-w-md p-5"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-base font-bold text-gray-800 mb-1">How much did you have?</h3>
          <p className="text-xs text-gray-400 mb-4">{dish.name}</p>

          <div className="space-y-2 mb-5">
            {options.map((opt) => {
              const isSelected = selected === opt.tier;
              return (
                <button
                  key={opt.tier}
                  onClick={() => setSelected(opt.tier)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-colors ${
                    isSelected ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? 'border-green-500' : 'border-gray-300'
                    }`}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-green-500" />}
                    </div>
                    <div className="text-left">
                      <p className={`text-sm font-medium ${isSelected ? 'text-green-700' : 'text-gray-700'}`}>
                        {opt.label}
                      </p>
                      {opt.weight_grams && (
                        <p className="text-xs text-gray-400">{opt.weight_grams}g</p>
                      )}
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${isSelected ? 'text-green-600' : 'text-gray-500'}`}>
                    {opt.calories_kcal != null ? `${opt.calories_kcal} kcal` : '—'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Disclaimer for DB-sourced data */}
          {dish.dataSource === 'database' && (
            <p className="text-xs text-gray-400 mb-4 text-center">
              Estimates based on INDB data with restaurant adjustment. Actual calories may vary ±15–20%.
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-3 rounded-xl bg-green-500 text-white font-semibold text-sm"
            >
              Confirm
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
