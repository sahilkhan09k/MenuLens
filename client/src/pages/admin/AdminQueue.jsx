import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../utils/api';

const TYPE_LABELS = { ai_sourced: '🤖 AI Sourced', user_feedback: '👤 User Feedback' };
const FEEDBACK_LABELS = { wrong_nutrition: 'Wrong nutrition', wrong_dish_name: 'Wrong name', missing_allergen: 'Missing allergen', other: 'Other' };

// ── Promote Modal ─────────────────────────────────────────────────────────────
function PromoteModal({ item, onClose, onPromoted }) {
  const n = item.ai_nutrition || {};
  const [form, setForm] = useState({
    canonical_name: item.dish_name?.toLowerCase().trim() || '',
    display_name_en: item.dish_name || '',
    category: '',
    cooking_method: n.cooking_method || 'unknown',
    calories_kcal: Math.round(((n.calories_min || 0) + (n.calories_max || 0)) / 2) || '',
    protein_g: Math.round(((n.protein_min || 0) + (n.protein_max || 0)) / 2) || '',
    carbs_g: Math.round(((n.carbs_min || 0) + (n.carbs_max || 0)) / 2) || '',
    fat_g: Math.round(((n.fat_min || 0) + (n.fat_max || 0)) / 2) || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/api/admin/queue/${item._id}/promote`, {
        category: form.category || 'other',
        cooking_method: form.cooking_method,
        nutrition: {
          portions: [{
            label: 'Standard Restaurant Serving',
            weight_grams: 250,
            calories_kcal: Number(form.calories_kcal),
            protein_g: Number(form.protein_g),
            carbs_g: Number(form.carbs_g),
            fat_g: Number(form.fat_g),
            is_default: true,
            tier: 'standard',
            restaurant_multiplier_applied: 1.0,
            multiplier_note: 'Admin verified from review queue',
          }],
        },
        admin_notes: `Promoted via admin queue. Display name: ${form.display_name_en}`,
      });
      toast.success('Dish promoted to database!');
      onPromoted(item._id);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Promote failed');
    } finally {
      setSaving(false);
    }
  };

  const f = (field) => ({
    value: form[field],
    onChange: e => setForm(prev => ({ ...prev, [field]: e.target.value })),
    className: 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-400',
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-800">Promote to Database</h2>
          <button onClick={onClose} className="text-gray-400 text-xl">×</button>
        </div>
        <p className="text-xs text-gray-500 mb-4">Review and confirm nutrition data before adding to the food database.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Canonical Name (lowercase)</label>
            <input {...f('canonical_name')} required />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Display Name</label>
            <input {...f('display_name_en')} required />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Category</label>
            <select {...f('category')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-400">
              <option value="">Select category</option>
              {['starter', 'main_course', 'bread', 'rice', 'dal', 'dessert', 'beverage', 'snack', 'salad', 'soup', 'other'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Cooking Method</label>
            <select {...f('cooking_method')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-400">
              {['grilled', 'fried', 'steamed', 'baked', 'raw', 'boiled', 'roasted', 'stir-fried', 'unknown'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <p className="text-xs font-semibold text-gray-600 pt-1">Nutrition (per standard serving)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Calories (kcal)</label>
              <input type="number" {...f('calories_kcal')} required />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Protein (g)</label>
              <input type="number" step="0.1" {...f('protein_g')} required />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Carbs (g)</label>
              <input type="number" step="0.1" {...f('carbs_g')} required />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Fat (g)</label>
              <input type="number" step="0.1" {...f('fat_g')} required />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-green-500 text-white rounded-xl font-semibold text-sm mt-2 disabled:opacity-60"
          >
            {saving ? 'Promoting...' : '✅ Add to Database'}
          </button>
        </form>
      </div>
    </div>
  );
}

function QueueItem({ item, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(item.admin_notes || '');
  const [saving, setSaving] = useState(false);
  const [showPromote, setShowPromote] = useState(false);

  const handleAction = async (status) => {
    setSaving(true);
    try {
      await api.put(`/api/admin/queue/${item._id}`, { status, admin_notes: notes });
      toast.success(`Marked as ${status}`);
      onUpdate(item._id, status);
    } catch { toast.error('Failed to update'); }
    finally { setSaving(false); }
  };

  const n = item.ai_nutrition;

  return (
    <div className="bg-white rounded-xl border border-gray-100 mb-3 overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{TYPE_LABELS[item.entry_type]}</span>
            <span className="text-xs text-orange-500 font-medium">P:{item.priority_score}</span>
          </div>
          <p className="text-sm font-semibold text-gray-800 truncate">{item.dish_name}</p>
          <p className="text-xs text-gray-400">{item.scan_count} scan{item.scan_count !== 1 ? 's' : ''} · {new Date(item.first_seen_at).toLocaleDateString()}</p>
        </div>
        <span className="text-gray-400 ml-2">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-50">
          {/* AI Nutrition */}
          {n && (
            <div className="mt-3 mb-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">AI Estimated Nutrition</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-gray-500">Calories</p>
                  <p className="font-medium">{n.calories_min}–{n.calories_max} kcal</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-gray-500">Protein</p>
                  <p className="font-medium">{n.protein_min}–{n.protein_max}g</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-gray-500">Carbs</p>
                  <p className="font-medium">{n.carbs_min}–{n.carbs_max}g</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-gray-500">Fat</p>
                  <p className="font-medium">{n.fat_min}–{n.fat_max}g</p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                <span>Method: {n.cooking_method || '—'}</span>
                <span>Confidence: <span className={n.confidence < 60 ? 'text-red-500 font-medium' : 'text-green-600 font-medium'}>{n.confidence}%</span></span>
              </div>
              {n.estimated_ingredients?.length > 0 && (
                <p className="text-xs text-gray-400 mt-1">Ingredients: {n.estimated_ingredients.join(', ')}</p>
              )}
            </div>
          )}

          {/* User feedback details */}
          {item.entry_type === 'user_feedback' && item.user_feedback && (
            <div className="mt-3 mb-3 bg-red-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-red-700 mb-1">User Feedback</p>
              <p className="text-xs text-red-600">{FEEDBACK_LABELS[item.user_feedback.feedback_type] || item.user_feedback.feedback_type}</p>
              {item.user_feedback.user_comment && (
                <p className="text-xs text-gray-600 mt-1">"{item.user_feedback.user_comment}"</p>
              )}
            </div>
          )}

          {/* Admin notes */}
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Admin notes (optional)..."
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 mt-2 focus:outline-none focus:ring-1 focus:ring-green-400 resize-none"
            rows={2}
          />

          {/* Actions */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => handleAction('rejected')}
              disabled={saving}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-medium"
            >
              Reject
            </button>
            <button
              onClick={() => handleAction('reviewed')}
              disabled={saving}
              className="flex-1 py-2 rounded-xl border border-blue-200 text-blue-600 text-xs font-medium"
            >
              Mark Reviewed
            </button>
            <button
              onClick={() => setShowPromote(true)}
              className="flex-1 py-2 rounded-xl bg-green-500 text-white text-xs font-semibold"
            >
              Promote →
            </button>
          </div>
        </div>
      )}
      {showPromote && (
        <PromoteModal
          item={item}
          onClose={() => setShowPromote(false)}
          onPromoted={(id) => onUpdate(id, 'promoted')}
        />
      )}
    </div>
  );
}

export default function AdminQueue() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('pending');
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status, page, limit: 15 });
      if (type) params.append('type', type);
      const res = await api.get(`/api/admin/queue?${params}`);
      setItems(res.data.items);
      setTotal(res.data.total);
    } catch { toast.error('Failed to load queue'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchQueue(); }, [status, type, page]);

  const handleUpdate = (id, newStatus) => {
    setItems(prev => prev.filter(i => i._id !== id));
    setTotal(prev => prev - 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/admin" className="text-gray-400 text-sm">← Dashboard</Link>
        <h1 className="text-xl font-bold text-gray-800">Review Queue</h1>
        <span className="ml-auto text-sm text-gray-500">{total} items</span>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['pending', 'reviewed', 'promoted', 'rejected'].map(s => (
          <button key={s} onClick={() => { setStatus(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${status === s ? 'bg-green-500 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {s}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          {['', 'ai_sourced', 'user_feedback'].map(t => (
            <button key={t} onClick={() => { setType(t); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${type === t ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
              {t === '' ? 'All' : t === 'ai_sourced' ? '🤖 AI' : '👤 User'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">✅</p>
          <p>No {status} items</p>
        </div>
      ) : (
        <>
          {items.map(item => (
            <QueueItem key={item._id} item={item} onUpdate={handleUpdate} />
          ))}
          {total > 15 && (
            <div className="flex justify-center gap-3 mt-4">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-xl border border-gray-200 text-sm disabled:opacity-40">← Prev</button>
              <span className="px-4 py-2 text-sm text-gray-500">Page {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 15 >= total} className="px-4 py-2 rounded-xl border border-gray-200 text-sm disabled:opacity-40">Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
