import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const GOALS = ['lose_weight', 'build_muscle', 'stay_healthy'];
const GOAL_LABELS = { lose_weight: 'Lose Weight', build_muscle: 'Build Muscle', stay_healthy: 'Stay Healthy' };

const DIET_TYPES = ['vegetarian', 'vegan', 'non_vegetarian', 'dairy_free', 'gluten_free', 'keto'];
const DIET_LABELS = { vegetarian: 'Vegetarian', vegan: 'Vegan', non_vegetarian: 'Non-Vegetarian', dairy_free: 'Dairy Free', gluten_free: 'Gluten Free', keto: 'Keto' };

const ALLERGY_OPTIONS = ['peanuts', 'shellfish', 'dairy', 'gluten', 'eggs', 'fish', 'tree_nuts', 'soy', 'none'];
const ALLERGY_LABELS = { peanuts: 'Peanuts', shellfish: 'Shellfish', dairy: 'Dairy', gluten: 'Gluten', eggs: 'Eggs', fish: 'Fish', tree_nuts: 'Tree Nuts', soy: 'Soy', none: 'None' };

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800 text-right max-w-[60%]">{value || '—'}</span>
    </div>
  );
}

export default function Profile() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [form, setForm] = useState({
    name: user?.name || '',
    goal: user?.profile?.goal || 'stay_healthy',
    dietType: user?.profile?.dietType || [],
    allergies: user?.profile?.allergies || [],
    dailyCalories: user?.profile?.dailyCalories || 2000,
  });

  const toggleMulti = (field, value) => {
    setForm(prev => {
      const arr = prev[field] || [];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value],
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.put('/api/user/profile', {
        name: form.name,
        goal: form.goal,
        dietType: form.dietType,
        allergies: form.allergies,
        dailyCalories: form.dailyCalories ? Number(form.dailyCalories) : undefined,
      });
      updateUser(res.data.user || form);
      toast.success('Profile updated!');
      setEditing(false);
    } catch {
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleDeleteAccount = async () => {
    try {
      await api.delete('/api/user/account');
      await logout();
      navigate('/');
    } catch {
      toast.error('Failed to delete account');
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  const dietArr = Array.isArray(user?.profile?.dietType) ? user.profile.dietType : [];
  const allergiesArr = Array.isArray(user?.profile?.allergies) ? user.profile.allergies : [];

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      <Navbar />
      <main className="pt-16 pb-20 px-4">
        <div className="mt-6 mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">Profile</h1>
          {!editing && (
            <button
              onClick={() => {
                setForm({
                  name: user?.name || '',
                  goal: user?.profile?.goal || 'stay_healthy',
                  dietType: Array.isArray(user?.profile?.dietType) ? user.profile.dietType : [],
                  allergies: Array.isArray(user?.profile?.allergies) ? user.profile.allergies : [],
                  dailyCalories: user?.profile?.dailyCalories || 2000,
                });
                setEditing(true);
              }}
              className="text-sm text-green-600 font-medium hover:text-green-700"
            >
              Edit
            </button>
          )}
        </div>

        {!editing ? (
          /* View mode */
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
            <InfoRow label="Name" value={user?.name} />
            <InfoRow label="Email" value={user?.email} />
            <InfoRow label="Goal" value={GOAL_LABELS[user?.profile?.goal] || user?.profile?.goal} />
            <InfoRow label="Diet" value={dietArr.map(d => DIET_LABELS[d] || d).join(', ') || 'None'} />
            <InfoRow label="Allergies" value={allergiesArr.map(a => ALLERGY_LABELS[a] || a).join(', ') || 'None'} />
            <InfoRow label="Daily Calories" value={user?.profile?.dailyCalories ? `${user.profile.dailyCalories} kcal` : null} />
          </div>
        ) : (
          /* Edit mode */
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>

            {/* Goal */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Goal</label>
              <div className="grid grid-cols-2 gap-2">
                {GOALS.map(g => (
                  <button
                    key={g}
                    onClick={() => setForm(p => ({ ...p, goal: g }))}
                    className={`py-2 px-3 rounded-xl text-sm font-medium border transition-colors ${form.goal === g ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'}`}
                  >
                    {GOAL_LABELS[g]}
                  </button>
                ))}
              </div>
            </div>

            {/* Diet types */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Diet Type</label>
              <div className="flex flex-wrap gap-2">
                {DIET_TYPES.map(d => (
                  <button
                    key={d}
                    onClick={() => toggleMulti('dietType', d)}
                    className={`py-1.5 px-3 rounded-full text-xs font-medium border transition-colors ${form.dietType.includes(d) ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'}`}
                  >
                    {DIET_LABELS[d]}
                  </button>
                ))}
              </div>
            </div>

            {/* Allergies */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Allergies</label>
              <div className="flex flex-wrap gap-2">
                {ALLERGY_OPTIONS.map(a => (
                  <button
                    key={a}
                    onClick={() => toggleMulti('allergies', a)}
                    className={`py-1.5 px-3 rounded-full text-xs font-medium border transition-colors ${form.allergies.includes(a) ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-600 border-gray-200 hover:border-red-300'}`}
                  >
                    {ALLERGY_LABELS[a]}
                  </button>
                ))}
              </div>
            </div>

            {/* Daily calories */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Daily Calories (kcal)</label>
              <input
                type="number"
                value={form.dailyCalories}
                onChange={e => setForm(p => ({ ...p, dailyCalories: e.target.value }))}
                placeholder="e.g. 2000"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setEditing(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-green-500 text-white font-medium hover:bg-green-600 disabled:bg-gray-300 transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors mb-3"
        >
          Log Out
        </button>

        {/* Delete account */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full py-3 rounded-xl border border-red-200 text-red-500 font-medium hover:bg-red-50 transition-colors"
        >
          Delete Account
        </button>
      </main>

      {/* Delete account confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-gray-800 mb-2">Delete your account?</h3>
            <p className="text-gray-500 text-sm mb-6">All your data will be permanently deleted. This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
