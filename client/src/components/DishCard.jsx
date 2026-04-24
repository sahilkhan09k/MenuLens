import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import TagChip from './TagChip';
import NutritionPill from './NutritionPill';
import { formatCalories } from '../utils/helpers';
import api from '../utils/api';

export default function DishCard({ dish, onSaveToggle }) {
  const navigate = useNavigate();
  const [isSaved, setIsSaved] = useState(dish.isSaved || false);
  const [saving, setSaving] = useState(false);

  const scoreColor = dish.matchScore >= 60
    ? 'bg-green-100 text-green-700'
    : dish.matchScore <= 30
    ? 'bg-red-100 text-red-700'
    : 'bg-yellow-100 text-yellow-700';

  const handleSaveToggle = async (e) => {
    e.stopPropagation(); // prevent navigation to detail page
    setSaving(true);
    try {
      const res = await api.put(`/api/dish/${dish._id}/save`);
      setIsSaved(res.data.isSaved);
      toast.success(res.data.isSaved ? 'Dish saved!' : 'Dish unsaved');
      onSaveToggle?.(dish._id, res.data.isSaved);
    } catch {
      toast.error('Could not save dish');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={() => navigate(`/dish/${dish._id}`)} className="bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow border border-gray-100 relative">
      {/* Bookmark button */}
      <button
        onClick={handleSaveToggle}
        disabled={saving}
        className="absolute top-3 right-3 text-lg transition-transform active:scale-90 disabled:opacity-50"
        title={isSaved ? 'Unsave' : 'Save'}
      >
        {isSaved ? '🔖' : '🏷️'}
      </button>

      <div className="flex items-start justify-between mb-2 pr-8">
        <h3 className="font-semibold text-gray-800 flex-1">{dish.name}</h3>
        <div className="flex items-center gap-1">
          {dish.allergenFlags?.length > 0 && <span title="Contains allergens">⚠️</span>}
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${scoreColor}`}>{dish.matchScore}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mb-2">
        {dish.tags?.slice(0, 3).map(tag => <TagChip key={tag} tag={tag} />)}
      </div>
      <NutritionPill label="Cal" value={formatCalories(dish.estimatedNutrition)} />
    </div>
  );
}
