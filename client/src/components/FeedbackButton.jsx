import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../utils/api';

const FEEDBACK_OPTIONS = [
  { value: 'wrong_nutrition', label: 'Nutrition values seem wrong' },
  { value: 'wrong_dish_name', label: 'Wrong dish identified' },
  { value: 'missing_allergen', label: 'Missing allergen warning' },
  { value: 'other', label: 'Other issue' },
];

export default function FeedbackButton({ dishId }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!selected) { toast.error('Please select a feedback type'); return; }
    setSubmitting(true);
    try {
      await api.post(`/api/feedback/dish/${dishId}`, {
        feedback_type: selected,
        user_comment: comment,
      });
      setSubmitted(true);
      setOpen(false);
      toast.success('Thanks for the feedback!');
    } catch {
      toast.error('Could not submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full mt-3 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-xs font-medium flex items-center justify-center gap-1.5"
      >
        <span>🚩</span> Report incorrect data
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              className="bg-white rounded-2xl w-full max-w-md p-5"
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-base font-bold text-gray-800 mb-1">Report an issue</h3>
              <p className="text-xs text-gray-400 mb-4">Help us improve our nutrition data</p>

              <div className="space-y-2 mb-4">
                {FEEDBACK_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSelected(opt.value)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-colors ${selected === opt.value ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-700'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Additional details (optional)..."
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                rows={2}
              />

              <div className="flex gap-3">
                <button onClick={() => setOpen(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium">
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !selected}
                  className="flex-1 py-3 rounded-xl bg-green-500 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Sending…' : 'Submit'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
