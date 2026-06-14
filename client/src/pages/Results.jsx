import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import DishCard from '../components/DishCard';
import ShareCardModal from '../components/ShareCard';
import ShareScanCardModal from '../components/ShareScanCard';
import { useAuth } from '../context/AuthContext';
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

function ComboCard({ combo, onDishClick }) {
  const dishes = [
    combo.starter      ? { ...combo.starter,      icon: '🥗', role: 'Starter' }      : null,
    combo.main         ? { ...combo.main,          icon: '🍛', role: 'Main' }          : null,
    combo.dessertDrink ? { ...combo.dessertDrink,  icon: '🍮', role: 'Dessert/Drink' } : null,
  ].filter(Boolean);

  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
          {combo.label}
        </span>
        <span className="text-xs text-gray-500">Score: {combo.comboScore}</span>
      </div>

      {/* Dish list */}
      <div className="space-y-2 mb-3">
        {dishes.map((dish, i) => (
          <button
            key={dish._id}
            onClick={() => onDishClick(dish._id)}
            className="w-full flex items-center gap-2 text-left hover:bg-white/60 rounded-lg px-2 py-1 transition-colors"
          >
            <span className="text-base shrink-0">{dish.icon}</span>
            <div className="flex-1 min-w-0">
              <span className="text-xs text-gray-500">{dish.role}</span>
              <p className="text-sm font-medium text-gray-800 truncate">{dish.name}</p>
            </div>
            <span className="text-xs text-green-600 font-medium shrink-0">{dish.matchScore}</span>
          </button>
        ))}
      </div>

      {/* Combined nutrition */}
      <div className="flex gap-3 pt-2 border-t border-green-200">
        <div className="text-center flex-1">
          <p className="text-xs font-bold text-gray-800">{combo.totalCalories}</p>
          <p className="text-xs text-gray-500">kcal</p>
        </div>
        <div className="text-center flex-1">
          <p className="text-xs font-bold text-gray-800">{combo.totalProtein}g</p>
          <p className="text-xs text-gray-500">protein</p>
        </div>
        <div className="text-center flex-1">
          <p className="text-xs font-bold text-gray-800">{combo.totalCarbs}g</p>
          <p className="text-xs text-gray-500">carbs</p>
        </div>
        <div className="text-center flex-1">
          <p className="text-xs font-bold text-gray-800">{combo.totalFat}g</p>
          <p className="text-xs text-gray-500">fat</p>
        </div>
      </div>
    </div>
  );
}

export default function Results() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [scan, setScan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [shareDish, setShareDish] = useState(null);
  const [showScanShare, setShowScanShare] = useState(false);
  const [restaurantHistory, setRestaurantHistory] = useState(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  useEffect(() => {
    api.get(`/api/scan/${scanId}`)
      .then(res => setScan(res.data))
      .catch(() => toast.error('Failed to load results'))
      .finally(() => setLoading(false));
  }, [scanId]);

  // Fetch restaurant visit history once scan is loaded
  useEffect(() => {
    if (!scan?.restaurantName) return;
    api.get('/api/scan/restaurant-history', {
      params: { name: scan.restaurantName, excludeScanId: scanId },
    })
      .then(res => {
        if (res.data.totalVisits > 0) {
          setRestaurantHistory(res.data);
        }
      })
      .catch(() => {}); // silent fail — non-critical feature
  }, [scan?.restaurantName, scanId]);

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
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-800">
              {scan.restaurantName || 'Scan Results'}
            </h1>
            <button
              onClick={() => setShowScanShare(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors"
            >
              <span>📤</span>
              <span>Share</span>
            </button>
          </div>
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

        {/* Restaurant memory — "You've been here before" */}
        {restaurantHistory && restaurantHistory.totalVisits > 0 && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-4">
            <button
              onClick={() => setHistoryExpanded(e => !e)}
              className="w-full flex items-start gap-3 text-left"
            >
              <span className="text-xl shrink-0">🔄</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-purple-800">
                  You've been to {scan.restaurantName} {restaurantHistory.totalVisits} time{restaurantHistory.totalVisits !== 1 ? 's' : ''} before
                </p>
                <p className="text-xs text-purple-600 mt-0.5">
                  Last visit: {new Date(restaurantHistory.visits[0]?.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <span className="text-purple-400 text-sm mt-0.5">{historyExpanded ? '▲' : '▼'}</span>
            </button>

            {historyExpanded && (
              <div className="mt-3 pt-3 border-t border-purple-200 space-y-3">
                {restaurantHistory.visits.map(visit => (
                  <div key={visit._id}>
                    <p className="text-xs text-purple-500 font-medium mb-1.5">
                      {new Date(visit.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {visit.totalDishes} dishes · {visit.recommendedCount} recommended
                    </p>
                    <div className="space-y-1">
                      {visit.topDishes.map(d => (
                        <button
                          key={d._id}
                          onClick={() => navigate('/dish/' + d._id)}
                          className="w-full flex items-center justify-between bg-white/70 rounded-lg px-3 py-2 text-left hover:bg-white transition-colors"
                        >
                          <span className="text-sm text-gray-800 truncate flex-1">{d.name}</span>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {d.calories && <span className="text-xs text-gray-400">{Math.round(d.calories)} kcal</span>}
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${d.matchScore >= 65 ? 'bg-green-100 text-green-700' : d.matchScore >= 45 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                              {d.matchScore}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => navigate('/history')}
                  className="w-full text-center text-xs text-purple-600 font-semibold py-1 hover:text-purple-800"
                >
                  View full scan history →
                </button>
              </div>
            )}
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
                {filteredAll.map(dish => <DishCard key={dish._id} dish={dish} onShareClick={setShareDish} />)}
              </div>
            )}
          </section>
        ) : (
          <>
            {/* Recommended Combos */}
            {scan.recommendedCombos?.length > 0 && (
              <section className="mb-6">
                <SectionHeader title="🍱 Recommended Combo" count={null} />
                {scan.recommendedCombos.map((combo, i) => (
                  <ComboCard
                    key={i}
                    combo={combo}
                    onDishClick={(dishId) => navigate('/dish/' + dishId)}
                  />
                ))}
              </section>
            )}

            {/* Recommended */}
            {filteredRecommended.length > 0 && (
              <section className="mb-6">
                <SectionHeader title="✅ Recommended for You" count={filteredRecommended.length} />
                <div className="space-y-3">
                  {topRec.map(dish => (
                    <div key={dish._id} className="ring-2 ring-green-200 rounded-xl">
                      <DishCard dish={dish} onShareClick={setShareDish} />
                    </div>
                  ))}
                  {moreRec.map(dish => <DishCard key={dish._id} dish={dish} onShareClick={setShareDish} />)}
                </div>
              </section>
            )}

            {/* Good choices */}
            {filteredGood.length > 0 && (
              <section className="mb-6">
                <SectionHeader title="👍 Good Choices" count={filteredGood.length} />
                <div className="space-y-3">
                  {filteredGood.map(dish => <DishCard key={dish._id} dish={dish} onShareClick={setShareDish} />)}
                </div>
              </section>
            )}

            {/* Avoid */}
            {filteredAvoid.length > 0 && (
              <section className="mb-6">
                <SectionHeader title="⚠️ Avoid" count={filteredAvoid.length} />
                <div className="space-y-3">
                  {filteredAvoid.map(dish => <DishCard key={dish._id} dish={dish} onShareClick={setShareDish} />)}
                </div>
              </section>
            )}

            {/* All dishes (neutral) */}
            {filteredRest.length > 0 && (
              <section className="mb-6">
                <SectionHeader title="🍽️ Other Dishes" count={filteredRest.length} />
                <div className="space-y-3">
                  {filteredRest.map(dish => <DishCard key={dish._id} dish={dish} onShareClick={setShareDish} />)}
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

      {/* Share individual dish modal */}
      {shareDish && (
        <ShareCardModal
          dish={shareDish}
          restaurantName={scan.restaurantName || null}
          goal={user?.profile?.goal || null}
          onClose={() => setShareDish(null)}
        />
      )}

      {/* Share scan summary modal */}
      {showScanShare && (
        <ShareScanCardModal
          scan={scan}
          dishes={dishes}
          restaurantName={scan.restaurantName}
          onClose={() => setShowScanShare(false)}
        />
      )}
    </div>
  );
}
