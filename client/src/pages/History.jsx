import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import api from '../utils/api';
import { formatDate } from '../utils/helpers';

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
    </div>
  );
}

export default function History() {
  const navigate = useNavigate();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchScans = async (p = 1, append = false) => {
    try {
      const res = await api.get(`/api/scan/history?page=${p}&limit=10`);
      const newScans = res.data.scans || [];
      setScans(prev => append ? [...prev, ...newScans] : newScans);
      const total = res.data.total || newScans.length;
      setHasMore((append ? scans.length + newScans.length : newScans.length) < total);
    } catch {
      toast.error('Failed to load history');
    }
  };

  useEffect(() => {
    fetchScans(1).finally(() => setLoading(false));
  }, []);

  const loadMore = async () => {
    setLoadingMore(true);
    const nextPage = page + 1;
    await fetchScans(nextPage, true);
    setPage(nextPage);
    setLoadingMore(false);
  };

  const handleDelete = async (scanId) => {
    try {
      await api.delete(`/api/scan/${scanId}`);
      setScans(prev => prev.filter(s => s._id !== scanId));
      toast.success('Scan deleted');
    } catch {
      toast.error('Failed to delete scan');
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      <Navbar />
      <main className="pt-16 pb-20 px-4">
        <div className="mt-6 mb-4">
          <h1 className="text-xl font-bold text-gray-800">Scan History</h1>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : scans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-5xl mb-4">📋</p>
            <p className="text-gray-500 font-medium">No scans yet.</p>
            <p className="text-gray-400 text-sm mt-1">Scan your first menu!</p>
            <button
              onClick={() => navigate('/scan')}
              className="mt-6 bg-green-500 text-white font-semibold px-6 py-3 rounded-2xl hover:bg-green-600 transition-colors"
            >
              Scan a Menu
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {scans.map(scan => (
              <div
                key={scan._id}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/results/${scan._id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{scan.restaurantName || 'Unnamed Scan'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(scan.createdAt)}</p>
                    <div className="flex gap-3 mt-1">
                      <p className="text-xs text-gray-500">{scan.totalDishesFound || 0} dishes</p>
                      {scan.totalMatchingDishes > 0 && (
                        <p className="text-xs text-green-600">{scan.totalMatchingDishes} recommended</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0" onClick={e => e.stopPropagation()}>
                    {scan.isSaved && <span className="text-yellow-500 text-lg">🔖</span>}
                    <button
                      onClick={() => setConfirmDelete(scan._id)}
                      className="text-gray-300 hover:text-red-400 transition-colors p-1"
                      title="Delete scan"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-3 text-sm text-green-600 font-medium hover:text-green-700 disabled:text-gray-400 transition-colors"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        )}
      </main>

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-gray-800 mb-2">Delete this scan?</h3>
            <p className="text-gray-500 text-sm mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
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
