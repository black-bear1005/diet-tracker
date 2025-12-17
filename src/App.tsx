import React, { useState, useEffect } from 'react';
import { UserProfile, DailyRecord } from './types';
import { loadUserProfile, loadDailyRecords } from './utils/storage';
import Auth from './components/Auth';
import { getCurrentUser, logout } from './services/bmob';
import { calculateMetrics } from './utils/calculations';
import UserProfileComponent from './components/UserProfile';
import DailyLogger from './components/DailyLogger';
import Dashboard from './components/Dashboard';
import TodoList from './components/TodoList';
import Store from './components/Store';
import NotificationCenter from './components/NotificationCenter';
import { format } from 'date-fns';
import { User, Calendar, BarChart3, CheckSquare, ShoppingBag } from 'lucide-react';

import { ToastProvider } from './components/Toast';

type TabType = 'profile' | 'logger' | 'dashboard' | 'todo' | 'store';

function App() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [userMetrics, setUserMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any | null>(getCurrentUser());

  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      setDailyRecords([]);
      setUserMetrics(null);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const profile = await loadUserProfile();
        const records = await loadDailyRecords();
        setUserProfile(profile);
        setDailyRecords(records);
        if (profile) {
          const metrics = calculateMetrics(profile);
          setUserMetrics(metrics);
          // 仅当之前没有选中 tab 时才自动跳转，避免刷新干扰
          if (activeTab === 'profile' && profile.weight) {
             setActiveTab('logger');
          }
        }
      } catch (e) {
        console.error('Failed to load user data:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]); // 依赖 user 变化，切换账号时自动重载

  const handleLogout = () => {
    logout();
    setUser(null);
    window.location.reload(); // 强制刷新页面，彻底清除内存状态
  };

  const handleProfileUpdate = (profile: UserProfile) => {
    setUserProfile(profile);
    const metrics = calculateMetrics(profile);
    setUserMetrics(metrics);
    setActiveTab('logger');
  };

  const tabs = [
    { id: 'profile' as TabType, label: '个人档案', icon: User },
    { id: 'logger' as TabType, label: '每日记录', icon: Calendar },
    { id: 'dashboard' as TabType, label: '数据看板', icon: BarChart3 },
    { id: 'todo' as TabType, label: '今日待办', icon: CheckSquare },
    { id: 'store' as TabType, label: '积分商城', icon: ShoppingBag }
  ];

  if (!user) {
    return (
      <ToastProvider>
        <Auth onSuccess={() => { setUser(getCurrentUser()); }} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">减肥追踪看板</h1>
            <div className="flex items-center gap-4">
                {user && (
                    <NotificationCenter onProfileUpdate={handleProfileUpdate} />
                )}
                <button
                    onClick={handleLogout}
                    className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
                >退出登录</button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center w-full">
            {/* Left Tabs */}
            <div className="flex space-x-8">
              {tabs.filter(t => t.id !== 'store').map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="mr-2" size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Right Tabs (Store) */}
            <div className="flex">
              {tabs.filter(t => t.id === 'store').map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-orange-500 hover:text-orange-700 hover:border-orange-300'
                    }`}
                  >
                    <Icon className="mr-2" size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && (
          <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
            <div className="bg-white rounded-md px-6 py-4 text-gray-700 shadow">
              加载中...
            </div>
          </div>
        )}
        {activeTab === 'profile' && (
          <UserProfileComponent
            profile={userProfile}
            onProfileUpdate={handleProfileUpdate}
          />
        )}

        {activeTab === 'logger' && userProfile && userMetrics && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <DailyLogger
                userProfile={userMetrics}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
              />
            </div>
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">今日概览</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">当前体重:</span>
                    <span className="font-medium">{userProfile.weight} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">BMI:</span>
                    <span className="font-medium">{userMetrics.bmi.toFixed(1)} ({userMetrics.bmiCategory})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">BMR:</span>
                    <span className="font-medium">{userMetrics.bmr.toFixed(0)} kcal</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">TDEE:</span>
                    <span className="font-medium">{userMetrics.tdee.toFixed(0)} kcal</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">建议摄入:</span>
                    <span className="font-medium text-blue-600">{userMetrics.dailyCalorieLimit.toFixed(0)} kcal</span>
                  </div>
                </div>
              </div>

              {/* Quick Tips */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">健康小贴士</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>• 建议每日记录体重，追踪变化趋势</p>
                  <p>• 保持500kcal的热量缺口，每周可减重约0.5kg</p>
                  <p>• 确保摄入热量不低于BMR，避免代谢下降</p>
                  <p>• 结合有氧运动和力量训练效果更佳</p>
                  <p>• 多喝水，保证充足睡眠</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && userProfile && userMetrics && (
          <Dashboard
            dailyRecords={dailyRecords}
            userProfile={userMetrics}
          />
        )}

        {activeTab === 'todo' && userProfile && (
          <TodoList
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
          />
        )}

        {activeTab === 'store' && userProfile && (
          <Store />
        )}

        {!userProfile && activeTab !== 'profile' && (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">
              <User size={48} className="mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">请先创建个人档案</h3>
              <p className="mb-4">创建个人档案后，即可开始使用每日记录和数据看板功能</p>
              <button
                onClick={() => setActiveTab('profile')}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                创建档案
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-500">
            <p>减肥追踪看板 - 科学管理，健康减重</p>
          </div>
        </div>
      </footer>
    </div>
    </ToastProvider>
  );
}

export default App;
