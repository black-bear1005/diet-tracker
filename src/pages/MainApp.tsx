import React, { useState, useEffect } from 'react';
import { UserProfile, DailyRecord } from '../types';
import { loadUserProfile, loadDailyRecords } from '../utils/storage';
import Auth from '../components/Auth';
import { getCurrentUser, logout, getLatestVersion, checkAndGiveLoginReward } from '../services/bmob';
import { calculateMetrics } from '../utils/calculations';
import UserProfileComponent from '../components/UserProfile';
import DailyLogger from '../components/DailyLogger';
import Dashboard from '../components/Dashboard';
import TodoList from '../components/TodoList';
import Store from '../components/Store';
import NotificationCenter from '../components/NotificationCenter';
import { format } from 'date-fns';
import { User, Calendar, BarChart3, CheckSquare, ShoppingBag, Download } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import PageTransition from '../components/PageTransition';

import { APP_CONFIG } from '../config';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { Capacitor } from '@capacitor/core';
import { useToast } from '../components/Toast';

// ToastProvider is now in App.tsx (root)

type TabType = 'profile' | 'logger' | 'dashboard' | 'todo' | 'store';

function MainApp() {
  const { showToast } = useToast();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [userMetrics, setUserMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState<any>(null);

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      try {
        const u = await getCurrentUser();
        setUser(u);
      } catch (e) {
        console.error('Session init failed:', e);
      } finally {
        setIsInitializing(false);
      }
    };
    initSession();

    // Check for updates
    const checkUpdate = async () => {
        try {
            const isAndroid = /Android/i.test(navigator.userAgent);
            const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
            const platform = isIOS ? 'ios' : 'android'; // Default to android
            
            const latest = await getLatestVersion(platform);
            const currentVersion = APP_CONFIG.VERSION;
            
            // Semantic version comparison
            const compareVersions = (v1: string, v2: string) => {
                const parts1 = v1.split('.').map(Number);
                const parts2 = v2.split('.').map(Number);
                for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
                    const p1 = parts1[i] || 0;
                    const p2 = parts2[i] || 0;
                    if (p1 > p2) return 1;
                    if (p1 < p2) return -1;
                }
                return 0;
            };

            if (latest && compareVersions(latest.version, currentVersion) > 0) {
                 setUpdateAvailable(latest);
            }
        } catch (e) {
            console.warn('Update check failed', e);
        }
    };
    checkUpdate();
  }, []);

  // Download logic
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async (url: string) => {
    // If not native (e.g. web browser), just open link
    if (!Capacitor.isNativePlatform()) {
      window.open(url, '_blank');
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      // 1. Download file as blob
      const response = await fetch(url);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      
      // 2. Write to filesystem
      const fileName = `update_${Date.now()}.apk`;
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const base64Content = base64data.split(',')[1];

        try {
          const result = await Filesystem.writeFile({
            path: fileName,
            data: base64Content,
            directory: Directory.Cache
          });

          // 3. Open file to install
          await FileOpener.open({
            filePath: result.uri,
            contentType: 'application/vnd.android.package-archive'
          });
          setIsDownloading(false);
        } catch (writeError) {
          console.error('File write/open error:', writeError);
          alert('安装包保存失败，请尝试使用浏览器下载');
          window.open(url, '_blank');
          setIsDownloading(false);
        }
      };
    } catch (error) {
      console.error('Download error:', error);
      alert('下载失败，即将跳转浏览器下载');
      window.open(url, '_blank');
      setIsDownloading(false);
    }
  };

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
          // 只有明确标记为未完成（isProfileCompleted === false）时才不跳转
          // 兼容旧数据（undefined）和已完成数据（true）
          if (activeTab === 'profile' && profile.isProfileCompleted !== false) {
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

  const handleLogout = async () => {
    await logout();
    setUser(null);
    window.location.reload(); // 强制刷新页面，彻底清除内存状态
  };

  const handleProfileUpdate = (profile: UserProfile) => {
    setUserProfile(profile);
    const metrics = calculateMetrics(profile);
    setUserMetrics(metrics);
    // 只有当之前的 profile 是未完成状态，且新的 profile 是已完成状态时，才跳转
    // 避免只是更新头像或简单修改信息时被强制跳转
    if (userProfile?.isProfileCompleted === false && profile.isProfileCompleted) {
        setActiveTab('logger');
    }
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
      <Auth onSuccess={() => { setUser(getCurrentUser()); }} />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-white/20 sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              减肥追踪看板 <span className="text-xs text-gray-400 font-normal">v{APP_CONFIG.VERSION}</span>
            </h1>
            <div className="flex items-center gap-4">
                {user && (
                    <NotificationCenter onProfileUpdate={handleProfileUpdate} />
                )}
                <button
                    onClick={handleLogout}
                    className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >退出登录</button>
            </div>
          </div>
        </div>
      </header>

      {/* Desktop Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-white/20 hidden md:block">
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
                    className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-colors relative ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="mr-2" size={16} />
                    {tab.label}
                    {activeTab === tab.id && (
                      <motion.div
                        layoutId="desktop-underline"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                      />
                    )}
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
                    className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-colors relative ${
                      activeTab === tab.id
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-orange-500 hover:text-orange-700 hover:border-orange-300'
                    }`}
                  >
                    <Icon className="mr-2" size={16} />
                    {tab.label}
                    {activeTab === tab.id && (
                      <motion.div
                        layoutId="desktop-underline-store"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <div className="fixed bottom-0 left-0 w-full backdrop-blur-md bg-white/90 border-t border-gray-100 z-50 flex justify-around items-center h-16 pb-[env(safe-area-inset-bottom)] md:hidden shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center w-full h-full space-y-1 ${
                isActive ? (tab.id === 'store' ? 'text-orange-500' : 'text-blue-500') : 'text-gray-400'
              }`}
              whileTap={{ scale: 0.9 }}
            >
              {isActive && (
                <motion.div
                  layoutId="mobile-nav-indicator"
                  className={`absolute inset-0 bg-gradient-to-t ${tab.id === 'store' ? 'from-orange-50' : 'from-blue-50'} to-transparent opacity-50`}
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <motion.div
                animate={isActive ? { y: -2 } : { y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              </motion.div>
              <span className="text-[10px] font-medium z-10">{tab.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        {loading && (
          <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white/90 backdrop-blur rounded-2xl px-6 py-4 text-gray-700 shadow-xl border border-white/20">
              加载中...
            </div>
          </div>
        )}
        
        <AnimatePresence mode="wait">
            {activeTab === 'profile' && (
            <PageTransition key="profile">
                <UserProfileComponent
                    profile={userProfile}
                    onProfileUpdate={handleProfileUpdate}
                />
            </PageTransition>
            )}

            {activeTab === 'logger' && userProfile && userMetrics && (
            <PageTransition key="logger">
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
                    <div className="backdrop-blur-xl bg-white/80 border border-white/20 shadow-lg shadow-blue-500/5 rounded-2xl p-6">
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
                    <div className="backdrop-blur-xl bg-white/80 border border-white/20 shadow-lg shadow-blue-500/5 rounded-2xl p-6">
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
            </PageTransition>
            )}

            {activeTab === 'dashboard' && userProfile && userMetrics && (
            <PageTransition key="dashboard">
                <Dashboard
                    dailyRecords={dailyRecords}
                    userProfile={userMetrics}
                />
            </PageTransition>
            )}

            {activeTab === 'todo' && userProfile && (
            <PageTransition key="todo">
                <TodoList
                    selectedDate={selectedDate}
                    onDateChange={setSelectedDate}
                />
            </PageTransition>
            )}

            {activeTab === 'store' && userProfile && (
            <PageTransition key="store">
                <Store />
            </PageTransition>
            )}

            {!userProfile && activeTab !== 'profile' && (
            <PageTransition key="empty">
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
            </PageTransition>
            )}
        </AnimatePresence>
      </main>

      {/* Update Modal */}
      <AnimatePresence>
        {updateAvailable && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl"
                >
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Download size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">发现新版本 {updateAvailable.version}</h3>
                        <p className="text-sm text-slate-500 mt-2">
                            {updateAvailable.forceUpdate ? '这是一个重要更新，请立即升级' : '建议您更新到最新版本以获得更好体验'}
                        </p>
                    </div>
                    
                    <div className="bg-slate-50 rounded-xl p-4 mb-6 text-sm text-slate-600 max-h-40 overflow-y-auto text-left">
                        <p className="font-medium mb-1 text-slate-800">更新内容：</p>
                        <p className="whitespace-pre-wrap">{updateAvailable.updateContent}</p>
                    </div>

                    <div className="space-y-3">
                        {(() => {
                            // Generate Mirror Link for China Users
                            const getMirrorUrl = (url: string) => {
                                const jsDelivrRegex = /https:\/\/cdn\.jsdelivr\.net\/gh\/([^/]+)\/([^@]+)@([^/]+)\/(.*)/;
                                const match = url.match(jsDelivrRegex);
                                if (match) {
                                    const [, user, repo, branch, path] = match;
                                    return `https://mirror.ghproxy.com/https://raw.githubusercontent.com/${user}/${repo}/${branch}/${path}`;
                                }
                                return null;
                            };
                            
                            const mirrorUrl = getMirrorUrl(updateAvailable.downloadUrl);

                            return (
                                <>
                                    {mirrorUrl ? (
                                        <>
                                            <button 
                                                onClick={() => handleDownload(mirrorUrl)}
                                                disabled={isDownloading}
                                                className="block w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors text-center shadow-lg shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isDownloading ? `下载中 ${downloadProgress > 0 ? downloadProgress + '%' : '...'}` : '🚀 极速更新 (推荐)'}
                                            </button>
                                            <button 
                                                onClick={() => handleDownload(updateAvailable.downloadUrl)}
                                                disabled={isDownloading}
                                                className="block w-full py-3 bg-white border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors text-center disabled:opacity-50"
                                            >
                                                普通下载 (CDN)
                                            </button>
                                        </>
                                    ) : (
                                        <button 
                                            onClick={() => handleDownload(updateAvailable.downloadUrl)}
                                            disabled={isDownloading}
                                            className="block w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors text-center shadow-lg shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isDownloading ? `下载中 ${downloadProgress > 0 ? downloadProgress + '%' : '...'}` : '立即更新'}
                                        </button>
                                    )}
                                </>
                            );
                        })()}
                        
                        {!updateAvailable.forceUpdate && (
                            <button 
                                onClick={() => setUpdateAvailable(null)}
                                className="block w-full py-3 text-slate-500 font-medium hover:bg-slate-50 rounded-xl transition-colors"
                            >
                                暂不更新
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MainApp;