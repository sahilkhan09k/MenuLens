import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import DishCard from '../components/DishCard';
import api from '../utils/api';
import { formatDate } from '../utils/helpers';

export default function Saved() {
  const navigate = useNavigate();
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/dish/saved')
      .then(res => setDishes(res.data.dishes || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
        <Navbar />
        <main className="pt-16 pb-20 px-4 mt-6">
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      <Navbar />
      <main className="pt-16 pb-20 px-4">
        <div className="mt-6 mb-4">
          <h1 className="text-xl font-bold text-gray-800">Saved Dishes</h1>
          <p className="text-gray-400 text-xs mt-0.5">{dishes.length} dish{dishes.length !== 1 ? 'es' : ''}</p>
        </div>

        {dishes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-5xl mb-4">🔖</p>
            <p className="text-gray-500 font-medium">No saved dishes yet</p>
            <p className="text-gray-400 text-sm mt-1 max-w-xs">Tap the bookmark icon on any dish to save it here</p>
            <button
              onClick={() => navigate('/scan')}
              className="mt-6 bg-green-500 text-white font-semibold px-6 py-3 rounded-2xl hover:bg-green-600 transition-colors"
            >
              Scan a Menu
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {dishes.map(dish => (
              <div key={dish._id} className="relative">
                <DishCard dish={dish} />
                {dish.scanId && (
                  <div className="mt-1 px-4 flex items-center gap-2 text-xs text-gray-400">
                    {dish.scanId.restaurantName && <span>{dish.scanId.restaurantName}</span>}
                    {dish.scanId.restaurantName && <span>·</span>}
                    <span>{formatDate(dish.savedAt || dish.scanId.createdAt)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
