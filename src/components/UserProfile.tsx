import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { UserProfile as UserProfileType, CalculatedMetrics } from '../types';
import { calculateMetrics } from '../utils/calculations';
import { saveUserProfile, updateUserAvatar } from '../utils/storage';
import { bindPartner, uploadFile } from '../services/bmob';
import { User, Activity, Heart, Coins, Link as LinkIcon, Edit2, Check, Ruler, Weight, Scale, Flame, Camera, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useToast } from './Toast';
import { motion, AnimatePresence } from 'framer-motion';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';

interface UserProfileProps {
  profile: UserProfileType | null;
  onProfileUpdate: (profile: UserProfileType) => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ profile, onProfileUpdate }) => {
  const { showToast } = useToast();
  // Allow empty strings for number inputs during editing
  const [formData, setFormData] = useState<Omit<UserProfileType, 'age' | 'height' | 'weight' | 'activityLevel' | 'calorieDeficit'> & {
      age: number | string;
      height: number | string;
      weight: number | string;
      activityLevel: number; // Select, usually no need for empty
      calorieDeficit: number | string;
      nickname: string;
      avatarUrl: string;
  }>({
    gender: 'male',
    age: 25,
    height: 170,
    weight: 70,
    activityLevel: 1.375,
    calorieDeficit: 500,
    nickname: '',
    avatarUrl: ''
  });

  const [metrics, setMetrics] = useState<CalculatedMetrics | null>(null);
  const [isEditing, setIsEditing] = useState(!profile);
  const [uploading, setUploading] = useState(false);
  
  // Couple features state
  const [partnerInput, setPartnerInput] = useState('');
  const [bindingLoading, setBindingLoading] = useState(false);
  const [bindError, setBindError] = useState('');

  // Cropper State
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setFormData({
          ...profile,
          nickname: profile.nickname || '',
          avatarUrl: profile.avatarUrl || ''
      });
      const calculatedMetrics = calculateMetrics(profile);
      setMetrics(calculatedMetrics);
    }
  }, [profile]);
  
  // Refresh points when entering profile page
  // Note: This logic is now handled in MainApp.tsx's handleTabChange
  // But keeping it here for safety if component is mounted independently or on refresh
  useEffect(() => {
     // ...
  }, []);

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 20 * 1024 * 1024) { // 20MB limit (compressed later)
         showToast('图片大小不能超过 20MB', 'error');
         return;
      }
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setCropImageSrc(reader.result?.toString() || null);
        setZoom(1);
        setCrop({ x: 0, y: 0 });
      });
      reader.readAsDataURL(file);
      // Reset input value to allow selecting the same file again
      e.target.value = '';
    }
  };

  const handleCropCancel = () => {
      setCropImageSrc(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
  };

  const handleCropConfirm = async () => {
    if (!cropImageSrc || !croppedAreaPixels) return;
    
    setUploading(true);
    try {
        const croppedBlob = await getCroppedImg(cropImageSrc, croppedAreaPixels);
        if (!croppedBlob) throw new Error('Crop failed');

        let url = '';
        try {
            // Create a File from Blob
            const file = new File([croppedBlob], `avatar_${Date.now()}.jpg`, { type: 'image/jpeg' });
            // Attempt Upload
            url = await uploadFile(file);
        } catch (uploadError: any) {
            console.warn('Bmob 文件服务不可用，降级使用 Base64 存储:', uploadError);
            
            // 如果是因为没有域名 (10007)，则降级为 Base64
            // 将 Blob 转换为 Base64
            url = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(croppedBlob);
            });
            
            // 简单的 Base64 长度检查，防止数据库爆字段 (虽然 Bmob String 应该能存)
            if (url.length > 100000) {
                // 如果图片太大，可能需要进一步压缩 (前端压缩逻辑可以在 getCroppedImg 里优化，这里先提示)
                console.warn('Base64 图片过大，可能会导致存储失败');
            }
        }
        
        setFormData(prev => ({ ...prev, avatarUrl: url }));
        
        // Auto-save avatar
        if (profile) {
            await updateUserAvatar(url);
            onProfileUpdate({ ...profile, avatarUrl: url });
        }
        
        // Close cropper
        setCropImageSrc(null);
        showToast('头像上传成功', 'success');
    } catch (error: any) {
        console.error('Avatar upload failed:', error);
        showToast('头像上传失败，请重试', 'error');
    } finally {
        setUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'age' || name === 'height' || name === 'weight' || name === 'calorieDeficit') {
        if (value === '') {
            setFormData(prev => ({ ...prev, [name]: '' }));
        } else {
            const num = parseFloat(value);
            if (!isNaN(num)) {
                setFormData(prev => ({ ...prev, [name]: num }));
            }
        }
    } else if (name === 'activityLevel') {
        setFormData(prev => ({ ...prev, [name]: Number(value) }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate number fields
    const age = typeof formData.age === 'string' ? (Number(formData.age) || 25) : formData.age;
    const height = typeof formData.height === 'string' ? (Number(formData.height) || 170) : formData.height;
    const weight = typeof formData.weight === 'string' ? (Number(formData.weight) || 70) : formData.weight;
    const calorieDeficit = typeof formData.calorieDeficit === 'string' ? (Number(formData.calorieDeficit) || 500) : formData.calorieDeficit;

    const safeData: UserProfileType = {
        ...formData,
        age,
        height,
        weight,
        calorieDeficit,
        activityLevel: formData.activityLevel,
        isProfileCompleted: true
    };

    const calculatedMetrics = calculateMetrics(safeData);
    setMetrics(calculatedMetrics);
    await saveUserProfile(safeData);
    onProfileUpdate(safeData);
    setIsEditing(false);
  };
  
  const handleBindPartner = async () => {
    if (!partnerInput.trim()) return;
    
    setBindingLoading(true);
    setBindError('');
    
    try {
      await bindPartner(partnerInput.trim());
      setPartnerInput('');
      showToast('已发送绑定请求，请等待对方在消息中心确认！', 'success');
    } catch (error: any) {
      console.error('Bind partner failed:', error);
      setBindError(error.message || '绑定失败，请检查用户名是否正确');
      showToast(error.message || '绑定失败', 'error');
    } finally {
      setBindingLoading(false);
    }
  };

  const activityLevels = [
    { value: 1.2, label: '久坐 (1.2)', description: '办公室工作，很少运动' },
    { value: 1.375, label: '轻度活动 (1.375)', description: '每周1-3次轻度运动' },
    { value: 1.55, label: '中度活动 (1.55)', description: '每周3-5次中度运动' },
    { value: 1.725, label: '高度活动 (1.725)', description: '每周6-7次高强度运动' },
    { value: 1.9, label: '极高活动 (1.9)', description: '专业运动员或体力劳动者' }
  ];

  if (!isEditing && profile && metrics) {
    // Determine BMI color
    let bmiColor = 'text-green-500';
    let bmiBg = 'bg-green-50/50 border-green-100/50';
    if (metrics.bmi < 18.5) {
        bmiColor = 'text-blue-500';
        bmiBg = 'bg-blue-50/50 border-blue-100/50';
    } else if (metrics.bmi >= 24) {
        bmiColor = 'text-orange-500';
        bmiBg = 'bg-orange-50/50 border-orange-100/50';
    }

    return (
      <motion.div 
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="space-y-4"
      >
        {/* Header Card */}
        <motion.div layout className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-sm rounded-2xl p-6 flex justify-between items-center">
            <div className="flex items-center gap-5">
                {/* Avatar */}
                <div className="relative">
                    {profile.avatarUrl ? (
                        <img 
                            src={profile.avatarUrl} 
                            alt="Avatar" 
                            className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md"
                        />
                    ) : (
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center text-blue-600 border-4 border-white shadow-md">
                            <User size={36} />
                        </div>
                    )}
                </div>
                
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-1">{profile.nickname || '用户'}</h2>
                    <p className="text-sm text-slate-400 font-medium font-mono">
                        ID: {profile.username || 'Unknown'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        {profile.gender === 'male' ? '男生' : '女生'}
                        <span className="w-1 h-1 bg-slate-300 rounded-full mx-1"></span>
                        已加入 {Math.floor((Date.now() - new Date(profile.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24)) + 1} 天
                    </p>
                </div>
            </div>
            <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsEditing(true)}
                className="p-3 bg-white border border-gray-100 text-slate-600 rounded-xl hover:bg-gray-50 shadow-sm transition-all"
            >
                <Edit2 size={18} />
            </motion.button>
        </motion.div>

        {/* Body Data Grid (Bento) */}
        <div className="grid grid-cols-2 gap-3">
            {/* Card 1: Basic Stats */}
            <motion.div layout className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-sm rounded-2xl p-5 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-medium text-slate-400">身体数据</span>
                    <Ruler size={14} className="text-slate-300" />
                </div>
                <div className="space-y-3">
                    <div className="flex justify-between items-end">
                        <span className="text-xs text-slate-500">身高</span>
                        <span className="text-lg font-bold text-slate-800">{profile.height} <span className="text-xs font-normal text-slate-400">cm</span></span>
                    </div>
                    <div className="flex justify-between items-end">
                        <span className="text-xs text-slate-500">体重</span>
                        <span className="text-lg font-bold text-slate-800">{profile.weight} <span className="text-xs font-normal text-slate-400">kg</span></span>
                    </div>
                    <div className="flex justify-between items-end">
                        <span className="text-xs text-slate-500">年龄</span>
                        <span className="text-lg font-bold text-slate-800">{profile.age} <span className="text-xs font-normal text-slate-400">岁</span></span>
                    </div>
                </div>
            </motion.div>

            {/* Card 2: BMI Dashboard */}
            <motion.div layout className={`backdrop-blur-xl border shadow-sm rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden ${bmiBg}`}>
                <div className="flex justify-between items-start z-10">
                    <span className="text-xs font-medium text-slate-500/80">BMI 指数</span>
                    <Scale size={14} className="text-slate-400/50" />
                </div>
                <div className="z-10 mt-2">
                    <div className={`text-4xl font-black ${bmiColor} tracking-tight`}>{metrics.bmi.toFixed(1)}</div>
                    <div className={`text-xs font-bold mt-1 px-2 py-1 rounded-full inline-block bg-white/60 backdrop-blur-sm ${bmiColor}`}>
                        {metrics.bmiCategory}
                    </div>
                </div>
                {/* Decoration */}
                <div className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-10 ${bmiColor.replace('text', 'bg')}`} />
            </motion.div>
        </div>

        {/* Metabolic Data (Capsule) */}
        <motion.div layout className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-sm rounded-2xl p-1">
            <div className="bg-white/50 rounded-xl p-4 flex justify-between items-center divide-x divide-gray-100">
                <div className="flex-1 text-center px-2">
                    <div className="text-[10px] text-slate-400 mb-1 uppercase tracking-wider">BMR 基代</div>
                    <div className="text-sm font-bold text-slate-700">{metrics.bmr.toFixed(0)}</div>
                </div>
                <div className="flex-1 text-center px-2">
                    <div className="text-[10px] text-slate-400 mb-1 uppercase tracking-wider">TDEE 总耗</div>
                    <div className="text-sm font-bold text-slate-700">{metrics.tdee.toFixed(0)}</div>
                </div>
                <div className="flex-1 text-center px-2">
                    <div className="text-[10px] text-slate-400 mb-1 uppercase tracking-wider">目标缺口</div>
                    <div className="text-sm font-bold text-slate-700">-{profile.calorieDeficit}</div>
                </div>
            </div>
        </motion.div>

        {/* Core Goal (Big Card) */}
        <motion.div layout className="flex flex-col gap-3 mt-4">
            {/* Target Card (Full Width) */}
            <motion.div 
                whileHover={{ y: -2 }}
                className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-3xl p-6 flex flex-col justify-center h-32 relative overflow-hidden shadow-sm"
            >
                <div className="relative z-10">
                    <div className="text-sm font-bold text-emerald-600/70 uppercase tracking-wider mb-1">每日建议摄入</div>
                    <div className="text-5xl font-black text-emerald-700 leading-none tracking-tight">
                        {metrics.dailyCalorieLimit.toFixed(0)}
                    </div>
                    <div className="text-sm font-bold text-emerald-500 mt-1">kcal / day</div>
                </div>
                {/* Big Decor Icon */}
                <div className="absolute -right-4 -bottom-4 text-emerald-500/10 transform rotate-12">
                    <Flame size={120} fill="currentColor" />
                </div>
            </motion.div>

            {/* Bottom Row (2 Equal Cards) */}
            <div className="grid grid-cols-2 gap-3 h-32">
                {/* Points Card */}
                <motion.div 
                    whileHover={{ y: -2 }}
                    className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex flex-col justify-center relative overflow-hidden shadow-sm"
                >
                    <div className="z-10">
                        <div className="text-xs font-bold text-amber-600/60 uppercase tracking-wider mb-1">积分</div>
                        <div className="text-3xl font-black text-amber-600 leading-none">
                            {profile.points || 0}
                        </div>
                    </div>
                    {/* Decor */}
                    <div className="absolute -bottom-4 -right-4 text-amber-500/10 transform -rotate-12 pointer-events-none">
                        <Coins className="w-24 h-24" fill="currentColor" />
                    </div>
                </motion.div>

                {/* Partner Card */}
                <motion.div 
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setPartnerInput('')}
                    className="bg-pink-50 border border-pink-100 rounded-2xl p-4 flex flex-col justify-center relative overflow-hidden shadow-sm cursor-pointer group"
                >
                    <div className="z-10 w-full relative">
                        <div className="text-xs font-bold text-pink-600/60 uppercase tracking-wider mb-1">伴侣</div>
                        {profile.partnerName ? (
                             <div className="text-xl font-black text-pink-700 leading-tight line-clamp-1 break-all">
                                {profile.partnerName}
                            </div>
                        ) : (
                            <div className="text-lg font-bold text-pink-400 group-hover:text-pink-600 transition-colors">
                                绑定
                            </div>
                        )}
                    </div>

                    {!profile.partnerName && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/95 opacity-0 hover:opacity-100 transition-opacity p-2">
                            <div className="w-full h-full flex flex-col justify-center gap-2">
                                <input
                                    type="text"
                                    inputMode="text"
                                    value={partnerInput}
                                    onChange={(e) => setPartnerInput(e.target.value)}
                                    placeholder="请输入对方账号"
                                    className="w-full text-[10px] border border-pink-200 rounded-lg px-2 py-1.5 focus:outline-none bg-white placeholder:text-[10px]"
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <p className="text-[8px] text-pink-400 leading-tight">* 请搜索对方唯一的登录账号</p>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleBindPartner(); }}
                                    className="w-full bg-pink-500 text-white text-[10px] py-1 rounded-lg font-bold hover:bg-pink-600"
                                >
                                    确定
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {/* Decor */}
                    <div className="absolute -bottom-4 -right-4 text-pink-500/10 transform rotate-12 pointer-events-none">
                        <Heart className="w-24 h-24" fill="currentColor" />
                    </div>
                </motion.div>
            </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div 
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-sm rounded-2xl p-6"
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800 flex items-center">
            <div className="p-2 bg-blue-50 rounded-xl mr-3 text-blue-600">
                <Edit2 size={20} />
            </div>
            {profile ? '编辑档案' : '创建档案'}
        </h2>
        {profile && (
            <button onClick={() => setIsEditing(false)} className="text-sm text-slate-400 hover:text-slate-600">取消</button>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Avatar Upload */}
        <div className="flex flex-col items-center mb-2">
            <div className="relative group cursor-pointer" onClick={() => document.getElementById('avatar-upload')?.click()}>
                {formData.avatarUrl ? (
                    <img 
                        src={formData.avatarUrl} 
                        alt="Avatar" 
                        className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md"
                    />
                ) : (
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 border-4 border-white shadow-md">
                        {uploading ? <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div> : <Camera size={32} />}
                    </div>
                )}
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="text-white" size={24} />
                </div>

                <input 
                    id="avatar-upload"
                    type="file" 
                    accept="image/*"
                    hidden
                    onChange={handleFileChange}
                    disabled={uploading}
                />

                {/* Delete Button */}
                {formData.avatarUrl && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setFormData(prev => ({ ...prev, avatarUrl: '' }));
                        }}
                        className="absolute -right-2 -bottom-2 p-2 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition-colors"
                    >
                        <Trash2 size={14} />
                    </button>
                )}
            </div>
            <p className="text-xs text-slate-400 mt-2">点击更换头像</p>
        </div>

        {/* Identity Fields */}
        <div className="grid grid-cols-1 gap-5 bg-white/50 p-4 rounded-2xl border border-white/40">
            <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-500 ml-1">昵称 (展示名称)</label>
                <input
                    type="text"
                    name="nickname"
                    value={formData.nickname}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-bold"
                    placeholder="请输入昵称"
                />
            </div>
            <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-500 ml-1">登录账号 (唯一ID)</label>
                <input
                    type="text"
                    value={profile?.username || ''}
                    disabled
                    readOnly
                    className="w-full px-4 py-3 bg-gray-100 border-none rounded-xl text-slate-500 font-mono text-sm"
                />
                <p className="text-[10px] text-slate-400 ml-1">
                    * 伴侣需搜索此账号进行绑定
                </p>
            </div>
        </div>

        {/* Compact Row for Basic Stats */}
        <div className="flex gap-3">
            <div className="flex-1 space-y-1">
                <label className="block text-xs font-bold text-slate-500 ml-1">年龄</label>
                <input
                    type="number"
                    inputMode="numeric"
                    name="age"
                    value={formData.age}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-bold text-center"
                    placeholder="25"
                    required
                />
            </div>
            <div className="flex-1 space-y-1">
                <label className="block text-xs font-bold text-slate-500 ml-1">身高 (cm)</label>
                <input
                    type="number"
                    inputMode="decimal"
                    name="height"
                    value={formData.height}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-bold text-center"
                    placeholder="170"
                    required
                />
            </div>
            <div className="flex-1 space-y-1">
                <label className="block text-xs font-bold text-slate-500 ml-1">体重 (kg)</label>
                <input
                    type="number"
                    inputMode="decimal"
                    name="weight"
                    value={formData.weight}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-bold text-center"
                    placeholder="60"
                    step="0.1"
                    required
                />
            </div>
        </div>

        <div className="grid grid-cols-1 gap-5">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-500 ml-1">性别</label>
            <div className="flex gap-3">
                {['male', 'female'].map(g => (
                    <button
                        key={g}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, gender: g as 'male' | 'female' }))}
                        className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                            formData.gender === g 
                            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' 
                            : 'bg-gray-50 text-slate-400 hover:bg-gray-100'
                        }`}
                    >
                        {g === 'male' ? '男生' : '女生'}
                    </button>
                ))}
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-500 ml-1 flex items-center">
              <Activity className="mr-1 text-blue-500" size={14} />
              日常活动强度
            </label>
            <select
              name="activityLevel"
              value={formData.activityLevel}
              onChange={handleInputChange}
              className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/20 text-slate-700 font-medium appearance-none"
              required
            >
              {activityLevels.map(level => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>
          
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-500 ml-1">目标热量缺口 (kcal)</label>
            <div className="relative">
                <input
                    type="number"
                    inputMode="numeric"
                    name="calorieDeficit"
                    value={formData.calorieDeficit}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-bold"
                    required
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium pointer-events-none">
                    建议 500
                </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 ml-1 flex items-center">
              <Check size={10} className="mr-1 text-green-500" />
              约每周减重 0.5kg
            </p>
          </div>
        </div>
        
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="submit"
          className="w-full px-4 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all text-sm"
        >
          {profile ? '保存修改' : '创建档案'}
        </motion.button>
      </form>

      {/* Cropper Modal - Portaled to body to avoid stacking context issues */}
      {createPortal(
        <AnimatePresence>
          {cropImageSrc && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] bg-black/95 flex flex-col h-[100dvh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Safe Area Top Spacer */}
                <div className="pt-safe-top bg-black" />

                <div className="flex-1 relative w-full bg-black overflow-hidden">
                    <Cropper
                        image={cropImageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                        cropShape="round"
                        showGrid={false}
                    />
                </div>
                
                <div className="flex-none w-full bg-white px-6 pt-8 pb-safe-bottom rounded-t-3xl shadow-2xl z-50">
                    <div className="flex items-center gap-4 mb-8">
                        <ZoomOut size={20} className="text-gray-400" />
                        <input
                            type="range"
                            value={zoom}
                            min={1}
                            max={3}
                            step={0.1}
                            aria-labelledby="Zoom"
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <ZoomIn size={20} className="text-gray-400" />
                    </div>
                    
                    <div className="flex gap-4 mb-12">
                        <button
                            onClick={handleCropCancel}
                            disabled={uploading}
                            className="flex-1 py-3 px-4 rounded-xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleCropConfirm}
                            disabled={uploading}
                            className="flex-1 py-3 px-4 rounded-xl font-bold bg-blue-600 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-colors flex items-center justify-center"
                        >
                            {uploading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                '确认并上传'
                            )}
                        </button>
                    </div>
                </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  );
};

export default UserProfile;
