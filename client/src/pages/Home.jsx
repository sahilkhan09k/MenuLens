import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import DishCard from '../components/DishCard';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { formatDate } from '../utils/helpers';

function Skeleton() {
  return <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 animate-pulse h-20" />;
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lastScan, setLastScan] = useState(null);
  const [stats, setStats] = useState({ total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/scan/last'),
      api.get('/api/scan/history?limit=1'),
    ]).then(([lastRes, histRes]) => {
      setLastScan(lastRes.data.scan);
      setStats({ total: histRes.data.total || 0 });
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      <Navbar />
      <main className="pt-16 pb-20 px-4">
        {/* Greeting */}
        <div className="mt-6 mb-5">
          <h1 className="text-2xl font-bold text-gray-800">
            Hi, {user?.name?.split(' ')[0] || 'there'}! 👋
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Ready to scan a menu?</p>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-5 flex items-center justify-between">
          <div className="text-center flex-1">
            <p className="text-2xl font-bold text-green-600">{stats.total}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total Scans</p>
          </div>
          <div className="w-px h-10 bg-gray-100" />
          <div className="text-center flex-1">
            <p className="text-2xl font-bold text-green-600">{lastScan?.totalDishesFound || 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">Last Scan Dishes</p>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => navigate('/scan')}
          className="w-full bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-semibold py-4 rounded-2xl text-lg shadow-md transition-colors mb-6"
        >
          📷 Scan a Menu
        </button>

        {/* Last scan section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-700">Last Restaurant</h2>
            {lastScan && (
              <button
                onClick={() => navigate(`/results/${lastScan._id}`)}
                className="text-xs text-green-600 font-medium"
              >
                View all →
              </button>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              <Skeleton /><Skeleton /><Skeleton />
            </div>
          ) : !lastScan ? (
            <div className="text-center py-10 text-gray-400">
              <p className="text-4xl mb-2">🍽️</p>
              <p className="text-sm">No scans yet. Tap "Scan a Menu" to get started!</p>
            </div>
          ) : (
            <>
              {/* Restaurant info */}
              <div className="bg-white rounded-xl px-4 py-3 border border-gray-100 mb-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{lastScan.restaurantName || 'Unnamed Restaurant'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(lastScan.createdAt)} · {lastScan.totalDishesFound} dishes
                    {lastScan.restaurantLocation?.address && (
                      <span> · {lastScan.restaurantLocation.address}</span>
                    )}
                  </p>
                </div>
                <span className="text-2xl">🏪</span>
              </div>

              {/* Top 3 dishes from last scan */}
              <div className="space-y-3">
                {(lastScan.dishes || []).slice(0, 3).map(dish => (
                  <DishCard key={dish._id} dish={dish} />
                ))}
                {(lastScan.dishes || []).length > 3 && (
                  <button
                    onClick={() => navigate(`/results/${lastScan._id}`)}
                    className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 font-medium"
                  >
                    +{lastScan.dishes.length - 3} more dishes
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
