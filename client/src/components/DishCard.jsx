import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import TagChip from './TagChip';
import NutritionPill from './NutritionPill';
import { formatCalories } from '../utils/helpers';
import api from '../utils/api';

export default function DishCard({ dish, onSaveToggle, onShareClick }) {
  const navigate = useNavigate();
  const [isSaved, setIsSaved] = useState(dish.isSaved || false);
  const [saving, setSaving] = useState(false);

  const scoreColor = dish.matchScore >= 65
    ? 'bg-green-500 text-white'
    : dish.matchScore >= 45
    ? 'bg-yellow-400 text-white'
    : dish.matchScore <= 25
    ? 'bg-red-500 text-white'
    : 'bg-orange-400 text-white';

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

  const handleShare = (e) => {
    e.stopPropagation();
    onShareClick?.(dish);
  };

  return (
    <div onClick={() => navigate(`/dish/${dish._id}`)} className="bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow border border-gray-100 relative">
      <div className="flex items-start gap-3">
        {/* Score circle — big and prominent on the left */}
        <div className={`shrink-0 w-14 h-14 rounded-full flex flex-col items-center justify-center ${scoreColor} shadow-sm`}>
          <span className="text-lg font-black leading-none">{dish.matchScore}</span>
          <span className="text-[9px] font-bold leading-none opacity-80 mt-0.5">score</span>
        </div>

        {/* Dish info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between pr-14">
            <h3 className="font-semibold text-gray-800 leading-tight">{dish.name}</h3>
            {dish.matchScore === 0 && <span title="Contains your allergens" className="shrink-0 ml-1">⚠️</span>}
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5 mb-2">
            {dish.tags?.slice(0, 3).map(tag => <TagChip key={tag} tag={tag} />)}
          </div>
          <NutritionPill label="Cal" value={formatCalories(dish.estimatedNutrition)} />
        </div>
      </div>

      {/* Bookmark + Share buttons — absolute top-right */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        {onShareClick && (
          <button
            onClick={handleShare}
            className="text-lg transition-transform active:scale-90 hover:scale-110"
            title="Share"
          >
            📤
          </button>
        )}
        <button
          onClick={handleSaveToggle}
          disabled={saving}
          className="text-lg transition-transform active:scale-90 disabled:opacity-50"
          title={isSaved ? 'Unsave' : 'Save'}
        >
          {isSaved ? '🔖' : '🏷️'}
        </button>
      </div>
    </div>
  );
}
