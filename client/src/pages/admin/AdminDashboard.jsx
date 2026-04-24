import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';

function StatCard({ label, value, color = 'green', sub }) {
  const colors = { green: 'text-green-600', blue: 'text-blue-600', orange: 'text-orange-500', red: 'text-red-500' };
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colors[color]}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [queueStats, setQueueStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/admin/stats'),
      api.get('/api/admin/queue/stats'),
    ]).then(([s, q]) => {
      setStats(s.data);
      setQueueStats(q.data);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
          <p className="text-sm text-gray-500">MenuLens data management</p>
        </div>
        <Link to="/admin/queue" className="bg-green-500 text-white text-sm font-semibold px-4 py-2 rounded-xl">
          Review Queue →
        </Link>
      </div>

      {/* Platform stats */}
      <h2 className="text-sm font-semibold text-gray-600 mb-3">Platform</h2>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard label="Total Users" value={stats?.totalUsers} color="blue" />
        <StatCard label="Total Scans" value={stats?.totalScans} sub={`${stats?.recentScans} this week`} />
        <StatCard label="Food Items in DB" value={stats?.totalFoodItems} color="green" />
        <StatCard label="Queue Pending" value={stats?.queuePending} color={stats?.queuePending > 50 ? 'red' : 'orange'} sub="needs review" />
      </div>

      {/* Queue stats */}
      <h2 className="text-sm font-semibold text-gray-600 mb-3">Review Queue</h2>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard label="AI-Sourced (pending)" value={queueStats?.aiSourced} color="orange" sub="not in DB" />
        <StatCard label="User Feedback (pending)" value={queueStats?.userFeedback} color="red" sub="flagged by users" />
        <StatCard label="Promoted to DB" value={queueStats?.promoted} color="green" />
        <StatCard label="Rejected" value={queueStats?.rejected} color="blue" />
      </div>

      {/* Top priority items */}
      {queueStats?.topPending?.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-gray-600 mb-3">Top Priority Items</h2>
          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
            {queueStats.topPending.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.dish_name}</p>
                  <p className="text-xs text-gray-400">{item.entry_type === 'ai_sourced' ? '🤖 AI sourced' : '👤 User feedback'} · {item.scan_count} scans</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-orange-500">Priority {item.priority_score}</span>
                  {item['ai_nutrition.confidence'] != null && (
                    <p className="text-xs text-gray-400">{item['ai_nutrition.confidence']}% confidence</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Link to="/admin/queue" className="block text-center text-sm text-green-600 font-medium mt-3">
            View all pending items →
          </Link>
        </>
      )}
    </div>
  );
}
