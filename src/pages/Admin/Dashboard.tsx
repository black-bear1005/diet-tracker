import React, { useEffect, useState } from 'react';
import { getDashboardStats } from '../../services/bmob';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    userCount: 0,
    foodCount: 0,
    todayActive: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      const data = await getDashboardStats();
      setStats(data);
      setLoading(false);
    };
    fetchStats();
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-6">仪表盘</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-slate-500 text-sm font-medium mb-2">总用户数</h3>
          <p className="text-3xl font-bold text-slate-800">
            {loading ? '...' : stats.userCount}
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-slate-500 text-sm font-medium mb-2">食物库数量</h3>
          <p className="text-3xl font-bold text-slate-800">
            {loading ? '...' : stats.foodCount}
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-slate-500 text-sm font-medium mb-2">今日活跃 (人)</h3>
          <p className="text-3xl font-bold text-slate-800">
            {loading ? '...' : stats.todayActive}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;