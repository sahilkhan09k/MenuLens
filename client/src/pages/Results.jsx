import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import DishCard from '../components/DishCard';
import api from '../utils/api';

const ALL_TAGS = ['High Protein', 'Low Carb', 'Low Calorie', 'High Calorie', 'Healthy Cook', 'Deep Fried', 'Fits Your Goal'];

function SectionHeader({ title, count }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-base font-semibold text-gray-700">{title}</h2>
      {count != null && <span className="text-xs text-gray-400">{count} dish{count !== 1 ? 'es' : ''}</span>}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
    </div>
  );
}

export default function Results() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const [scan, setScan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState('');

  useEffect(() => {
    api.get(`/api/scan/${scanId}`)
      .then(res => setScan(res.data))
      .catch(() => toast.error('Failed to load results'))
      .finally(() => setLoading(false));
  }, [scanId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
        <Navbar />
        <main className="pt-16 pb-20 px-4 mt-6 space-y-3">
          {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
        </main>
        <BottomNav />
      </div>
    );
  }
  if (!scan) {
    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
        <Navbar />
        <main className="pt-16 pb-20 px-4 flex items-center justify-center min-h-[80vh]">
          <p className="text-gray-400">Scan not found.</p>
        </main>
        <BottomNav />
      </div>
    );
  }

  const dishes = [...(scan.dishes || [])].sort((a, b) => b.matchScore - a.matchScore);
  // Avoid: score ≤ 25 OR has an allergen the user actually declared
  // Do NOT avoid dishes just because they contain dairy/gluten if user has no such allergy
  const avoid = dishes.filter(d => d.matchScore <= 25);
  const avoidIds = new Set(avoid.map(d => d._id));
  const recommended = dishes.filter(d => !avoidIds.has(d._id) && d.matchScore >= 65);
  const good        = dishes.filter(d => !avoidIds.has(d._id) && d.matchScore >= 45 && d.matchScore < 65);
  const recommendedIds = new Set(recommended.map(d => d._id));
  const goodIds        = new Set(good.map(d => d._id));
  const rest = dishes.filter(d => !avoidIds.has(d._id) && !recommendedIds.has(d._id) && !goodIds.has(d._id));

  // Scan quality banners
  const isPartial = scan.scanQuality === 'partial';
  const isLowConfidence = scan.scanQuality === 'low_confidence';

  // ── Search + filter logic (pure client-side, no API calls) ─────────────────
  const filterDish = (dish) => {
    // Text search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const nameMatch = dish.name?.toLowerCase().includes(q);
      const tagMatch = dish.tags?.some(t => t.toLowerCase().includes(q));
      if (!nameMatch && !tagMatch) return false;
    }
    // Tag filter
    if (activeTag && !dish.tags?.includes(activeTag)) return false;
    return true;
  };

  const isFiltering = searchQuery.trim() !== '' || activeTag !== '';

  // When filtering, show all matching dishes in a flat list (ignore sections)
  const filteredAll = isFiltering ? dishes.filter(filterDish) : null;

  const filteredRecommended = recommended.filter(filterDish);
  const filteredGood        = good.filter(filterDish);
  const filteredAvoid       = avoid.filter(filterDish);
  const filteredRest        = rest.filter(filterDish);

  const topRec  = !isFiltering ? filteredRecommended.slice(0, 3) : [];
  const moreRec = !isFiltering ? filteredRecommended.slice(3) : [];

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      <Navbar />
      <main className="pt-16 pb-20 px-4">
        {/* Header */}
        <div className="mt-6 mb-4">
          <h1 className="text-xl font-bold text-gray-800">
            {scan.restaurantName || 'Scan Results'}
          </h1>
          <p className="text-gray-400 text-xs mt-0.5">{dishes.length} dishes found · tap 🏷️ to save any dish</p>
        </div>

        {/* Scan quality banners */}
        {isPartial && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex gap-3">
            <span className="text-xl shrink-0">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">Partial scan detected</p>
              <p className="text-xs text-amber-700 mt-0.5">{scan.scanQualityNote || 'Only a few dishes were detected. For better results, try a clearer photo with good lighting.'}</p>
              <button onClick={() => navigate('/scan')} className="text-xs text-amber-700 font-semibold underline mt-1">Scan again with better photo →</button>
            </div>
          </div>
        )}
        {isLowConfidence && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex gap-3">
            <span className="text-xl shrink-0">🔍</span>
            <div>
              <p className="text-sm font-semibold text-blue-800">Low confidence results</p>
              <p className="text-xs text-blue-700 mt-0.5">{scan.scanQualityNote || 'Nutrition estimates may be less accurate. A clearer photo would improve results.'}</p>
              <button onClick={() => navigate('/scan')} className="text-xs text-blue-700 font-semibold underline mt-1">Try a clearer photo →</button>
            </div>
          </div>
        )}

        {/* Search + Filter */}
        <div className="mb-4">
          {/* Search input */}
          <div className="relative mb-3">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search dishes..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg leading-none">×</button>
            )}
          </div>

          {/* Tag filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setActiveTag('')}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeTag === '' ? 'bg-green-500 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
            >
              All
            </button>
            {ALL_TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? '' : tag)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeTag === tag ? 'bg-green-500 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Filtered results — flat list when searching */}
        {isFiltering ? (
          <section className="mb-6">
            <SectionHeader title={`Results (${filteredAll.length})`} count={null} />
            {filteredAll.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-3xl mb-2">🔍</p>
                <p className="text-sm">No dishes match "{searchQuery || activeTag}"</p>
                <button onClick={() => { setSearchQuery(''); setActiveTag(''); }} className="text-xs text-green-600 font-medium mt-2">Clear filters</button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAll.map(dish => <DishCard key={dish._id} dish={dish} />)}
              </div>
            )}
          </section>
        ) : (
          <>
            {/* Recommended */}
            {filteredRecommended.length > 0 && (
              <section className="mb-6">
                <SectionHeader title="✅ Recommended for You" count={filteredRecommended.length} />
                <div className="space-y-3">
                  {topRec.map(dish => (
                    <div key={dish._id} className="ring-2 ring-green-200 rounded-xl">
                      <DishCard dish={dish} />
                    </div>
                  ))}
                  {moreRec.map(dish => <DishCard key={dish._id} dish={dish} />)}
                </div>
              </section>
            )}

            {/* Good choices */}
            {filteredGood.length > 0 && (
              <section className="mb-6">
                <SectionHeader title="👍 Good Choices" count={filteredGood.length} />
                <div className="space-y-3">
                  {filteredGood.map(dish => <DishCard key={dish._id} dish={dish} />)}
                </div>
              </section>
            )}

            {/* Avoid */}
            {filteredAvoid.length > 0 && (
              <section className="mb-6">
                <SectionHeader title="⚠️ Avoid" count={filteredAvoid.length} />
                <div className="space-y-3">
                  {filteredAvoid.map(dish => <DishCard key={dish._id} dish={dish} />)}
                </div>
              </section>
            )}

            {/* All dishes (neutral) */}
            {filteredRest.length > 0 && (
              <section className="mb-6">
                <SectionHeader title="🍽️ All Dishes" count={filteredRest.length} />
                <div className="space-y-3">
                  {filteredRest.map(dish => <DishCard key={dish._id} dish={dish} />)}
                </div>
              </section>
            )}

            {dishes.length === 0 && (
              <p className="text-center text-gray-400 py-12">No dishes found in this scan.</p>
            )}
          </>
        )}

        {/* Disclaimer — subtle, always visible, like Claude/GPT */}
        <p className="text-center text-xs text-gray-400 pb-2 leading-relaxed">
          Nutrition estimates are AI-generated and may vary. Always confirm allergens with restaurant staff.
        </p>
      </main>
      <BottomNav />
    </div>
  );
}
