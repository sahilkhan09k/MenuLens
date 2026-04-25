import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { formatDate } from '../utils/helpers';

function Skeleton() {
  return <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 animate-pulse h-16" />;
}

function ScanCard({ scan, onClick }) {
  const qualityColor = {
    good: 'bg-green-100 text-green-700',
    partial: 'bg-amber-100 text-amber-700',
    low_confidence: 'bg-blue-100 text-blue-700',
    unreadable: 'bg-red-100 text-red-700',
  }[scan.scanQuality] || 'bg-gray-100 text-gray-600';

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm flex items-center justify-between text-left active:bg-gray-50 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-2xl shrink-0">🏪</span>
        <div className="min-w-0">
          <p className="font-semibold text-gray-800 truncate">
            {scan.restaurantName || 'Unnamed Restaurant'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {formatDate(scan.createdAt)} · {scan.totalDishesFound} dishes
            {scan.restaurantLocation?.address && (
              <span className="hidden sm:inline"> · {scan.restaurantLocation.address}</span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {scan.scanQuality && scan.scanQuality !== 'good' && (
          <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + qualityColor}>
            {scan.scanQuality === 'partial' ? 'Partial' : scan.scanQuality === 'low_confidence' ? 'Low conf.' : 'Error'}
          </span>
        )}
        <span className="text-gray-300 text-sm">›</span>
      </div>
    </button>
  );
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recentScans, setRecentScans] = useState([]);
  const [totalScans, setTotalScans] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/scan/last'),
      api.get('/api/scan/history?limit=1'),
    ]).then(([lastRes, histRes]) => {
      setRecentScans(lastRes.data.scans || []);
      setTotalScans(histRes.data.total || 0);
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
            <p className="text-2xl font-bold text-green-600">{totalScans}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total Scans</p>
          </div>
          <div className="w-px h-10 bg-gray-100" />
          <div className="text-center flex-1">
            <p className="text-2xl font-bold text-green-600">{recentScans[0]?.totalDishesFound || 0}</p>
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

        {/* Recent scans section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-700">Recent Scans</h2>
            {totalScans > 5 && (
              <button
                onClick={() => navigate('/history')}
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
          ) : recentScans.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p className="text-4xl mb-2">🍽️</p>
              <p className="text-sm">No scans yet. Tap "Scan a Menu" to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentScans.map(scan => (
                <ScanCard
                  key={scan._id}
                  scan={scan}
                  onClick={() => navigate('/results/' + scan._id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
