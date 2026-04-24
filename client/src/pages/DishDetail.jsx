import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import TagChip from '../components/TagChip';
import PortionPicker from '../components/PortionPicker';
import FeedbackButton from '../components/FeedbackButton';
import api from '../utils/api';
import { formatRange, formatAvg } from '../utils/helpers';

function SaveDishButton({ dishId, initialSaved }) {
  const [isSaved, setIsSaved] = useState(initialSaved || false);
  const [saving, setSaving] = useState(false);

  const toggle = async (e) => {
    e.stopPropagation();
    setSaving(true);
    try {
      const res = await api.put(`/api/dish/${dishId}/save`);
      setIsSaved(res.data.isSaved);
      toast.success(res.data.isSaved ? '🔖 Dish saved!' : 'Dish unsaved');
    } catch {
      toast.error('Could not save dish');
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={saving}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
        isSaved ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
      }`}
    >
      <span>{isSaved ? '🔖' : '🏷️'}</span>
      <span>{isSaved ? 'Saved' : 'Save'}</span>
    </button>
  );
}

function MacroRow({ label, nutrition, macro, unit = 'g' }) {
  const data = nutrition?.[macro];
  if (!data) return null;
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="text-right">
        <span className="text-sm font-medium text-gray-800">{formatRange(data.min, data.max, unit)}</span>
        <span className="text-xs text-gray-400 ml-2">avg {formatAvg(data.avg, unit)}</span>
      </div>
    </div>
  );
}

export default function DishDetail() {
  const { dishId } = useParams();
  const navigate = useNavigate();
  const [dish, setDish] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPortionPicker, setShowPortionPicker] = useState(false);
  const [selectedTier, setSelectedTier] = useState('standard');
  const [selectedNutrition, setSelectedNutrition] = useState(null);

  useEffect(() => {
    api.get(`/api/dish/${dishId}`)
      .then(res => setDish(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dishId]);

  // Compute displayed nutrition — use selected tier if available, else dish default
  const displayNutrition = selectedNutrition
    ? {
        calories: selectedNutrition.calories_kcal != null ? { min: Math.round(selectedNutrition.calories_kcal * 0.9), max: Math.round(selectedNutrition.calories_kcal * 1.1), avg: selectedNutrition.calories_kcal } : null,
        protein:  selectedNutrition.protein_g != null ? { min: Math.round(selectedNutrition.protein_g * 0.9 * 10) / 10, max: Math.round(selectedNutrition.protein_g * 1.1 * 10) / 10, avg: selectedNutrition.protein_g } : null,
        carbs:    selectedNutrition.carbs_g != null ? { min: Math.round(selectedNutrition.carbs_g * 0.9 * 10) / 10, max: Math.round(selectedNutrition.carbs_g * 1.1 * 10) / 10, avg: selectedNutrition.carbs_g } : null,
        fat:      selectedNutrition.fat_g != null ? { min: Math.round(selectedNutrition.fat_g * 0.9 * 10) / 10, max: Math.round(selectedNutrition.fat_g * 1.1 * 10) / 10, avg: selectedNutrition.fat_g } : null,
      }
    : dish?.estimatedNutrition;

  const hasTiers = dish?.portionTiers && (dish.portionTiers.small || dish.portionTiers.large);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
        <Navbar />
        <main className="pt-16 px-4 mt-6 animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-2/3" />
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-3/4" />
        </main>
      </div>
    );
  }

  if (!dish) {
    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
        <Navbar />
        <main className="pt-16 px-4 flex items-center justify-center min-h-[80vh]">
          <p className="text-gray-400">Dish not found.</p>
        </main>
      </div>
    );
  }

  const confidence = dish.confidenceScore ?? 0;
  const confColor = confidence >= 70 ? 'bg-green-500' : confidence >= 40 ? 'bg-yellow-400' : 'bg-red-400';
  const confLabel = confidence >= 70 ? 'text-green-700' : confidence >= 40 ? 'text-yellow-700' : 'text-red-700';

  return (
    <>
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      <Navbar />
      <main className="pt-16 pb-8 px-4">
        {/* Back + Save */}
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-gray-500 text-sm hover:text-green-600 transition-colors"
          >
            ← Back
          </button>
          <SaveDishButton dishId={dishId} initialSaved={dish.isSaved} />
        </div>

        {/* Name + cooking method */}
        <div className="mt-4 mb-2 flex items-start justify-between gap-2">
          <h1 className="text-2xl font-bold text-gray-800 flex-1">{dish.name}</h1>
          {dish.cookingMethod && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full whitespace-nowrap mt-1">
              {dish.cookingMethod}
            </span>
          )}
        </div>

        {/* Description */}
        {dish.description && (
          <p className="text-gray-500 text-sm mb-3">{dish.description}</p>
        )}

        {/* Price */}
        {dish.estimatedPrice != null && (
          <p className="text-green-600 font-semibold text-sm mb-3">~${dish.estimatedPrice}</p>
        )}

        {/* Tags */}
        {dish.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {dish.tags.map(tag => <TagChip key={tag} tag={tag} />)}
          </div>
        )}

        {/* Nutrition */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700">Nutrition Estimates</h2>
            {hasTiers && (
              <button
                onClick={() => setShowPortionPicker(true)}
                className="flex items-center gap-1 text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-full"
              >
                <span>⚖️</span>
                <span>{selectedTier === 'standard' ? 'Standard' : selectedTier === 'small' ? 'Small' : 'Large'}</span>
                <span className="text-gray-400">▾</span>
              </button>
            )}
          </div>
          <MacroRow label="Calories" nutrition={displayNutrition} macro="calories" unit="kcal" />
          <MacroRow label="Protein" nutrition={displayNutrition} macro="protein" />
          <MacroRow label="Carbs" nutrition={displayNutrition} macro="carbs" />
          <MacroRow label="Fat" nutrition={displayNutrition} macro="fat" />
          {selectedNutrition && (
            <p className="text-xs text-green-600 mt-2">
              Showing: {selectedNutrition.label} ({selectedNutrition.weight_grams}g)
            </p>
          )}
        </div>

        {/* Confidence */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700">Confidence Score</h2>
            <span className={`text-sm font-bold ${confLabel}`}>{confidence}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className={`h-2 rounded-full transition-all ${confColor}`} style={{ width: `${confidence}%` }} />
          </div>
          {confidence < 40 && (
            <p className="text-xs text-red-500 mt-2">⚠️ Low confidence estimate</p>
          )}
        </div>

        {/* Recommend / Avoid reasons */}
        {dish.recommendReason && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
            <p className="text-green-700 text-sm">✅ {dish.recommendReason}</p>
          </div>
        )}
        {dish.avoidReasons?.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
            {dish.avoidReasons.map((r, i) => (
              <p key={i} className="text-red-700 text-sm">❌ {r}</p>
            ))}
          </div>
        )}

        {/* Allergen flags — prominent warning if present */}
        {dish.allergenFlags?.length > 0 && (
          <div className="mb-4 bg-red-50 border-2 border-red-300 rounded-xl p-3">
            <p className="text-red-700 text-sm font-semibold mb-2">⚠️ Contains Allergens</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {dish.allergenFlags.map(flag => (
                <span key={flag} className="bg-red-100 text-red-700 text-xs font-medium px-2 py-1 rounded-full">
                  {flag}
                </span>
              ))}
            </div>
            <p className="text-red-600 text-xs">Always confirm allergen information directly with restaurant staff before ordering.</p>
          </div>
        )}

        {/* Disclaimer */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mt-2">
          <p className="text-yellow-700 text-xs leading-relaxed">
            ⚠️ Nutritional estimates are AI-generated and not medical advice. Always consult a healthcare professional for dietary guidance.
          </p>
        </div>

        {/* User feedback button */}
        <FeedbackButton dishId={dishId} />

        {/* Restaurant adjustment note — shown when DB data has a multiplier applied */}
        {dish.dataSource === 'database' && dish.multiplierNote && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mt-2">
            <p className="text-blue-700 text-xs leading-relaxed">
              🍽️ Restaurant adjustment applied: {dish.multiplierNote}
            </p>
          </div>
        )}
      </main>
    </div>

    {/* Portion picker modal */}
    {showPortionPicker && (
      <PortionPicker
        dish={dish}
        onSelect={(tier, nutrition) => {
          setSelectedTier(tier);
          setSelectedNutrition(nutrition);
        }}
        onClose={() => setShowPortionPicker(false)}
      />
    )}
    </>
  );
}
