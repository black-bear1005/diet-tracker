import React, { useState, useEffect } from 'react';
import type { UserProfile as UserProfileType, CalculatedMetrics } from '../types';
import { calculateMetrics } from '../utils/calculations';
import { saveUserProfile } from '../utils/storage';
import { User, Activity } from 'lucide-react';

interface UserProfileProps {
  profile: UserProfileType | null;
  onProfileUpdate: (profile: UserProfileType) => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ profile, onProfileUpdate }) => {
  const [formData, setFormData] = useState<UserProfileType>({
    gender: 'male',
    age: 25,
    height: 170,
    weight: 70,
    activityLevel: 1.375,
    calorieDeficit: 500
  });

  const [metrics, setMetrics] = useState<CalculatedMetrics | null>(null);
  const [isEditing, setIsEditing] = useState(!profile);

  useEffect(() => {
    if (profile) {
      setFormData(profile);
      const calculatedMetrics = calculateMetrics(profile);
      setMetrics(calculatedMetrics);
    }
  }, [profile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newValue = name === 'age' || name === 'height' || name === 'weight' || name === 'calorieDeficit' 
      ? Number(value) 
      : name === 'activityLevel' ? Number(value) : value;
    
    setFormData(prev => ({ ...prev, [name]: newValue }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const calculatedMetrics = calculateMetrics(formData);
    setMetrics(calculatedMetrics);
    await saveUserProfile(formData);
    onProfileUpdate(formData);
    setIsEditing(false);
  };

  const activityLevels = [
    { value: 1.2, label: '久坐 (1.2)', description: '办公室工作，很少运动' },
    { value: 1.375, label: '轻度活动 (1.375)', description: '每周1-3次轻度运动' },
    { value: 1.55, label: '中度活动 (1.55)', description: '每周3-5次中度运动' },
    { value: 1.725, label: '高度活动 (1.725)', description: '每周6-7次高强度运动' },
    { value: 1.9, label: '极高活动 (1.9)', description: '专业运动员或体力劳动者' }
  ];

  if (!isEditing && profile && metrics) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <User className="mr-2" size={24} />
            个人档案
          </h2>
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            编辑
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p><span className="font-medium">性别:</span> {profile.gender === 'male' ? '男' : '女'}</p>
            <p><span className="font-medium">年龄:</span> {profile.age} 岁</p>
            <p><span className="font-medium">身高:</span> {profile.height} cm</p>
            <p><span className="font-medium">体重:</span> {profile.weight} kg</p>
          </div>
          
          <div className="space-y-2">
            <p><span className="font-medium">BMI:</span> {metrics.bmi.toFixed(1)} ({metrics.bmiCategory})</p>
            <p><span className="font-medium">BMR:</span> {metrics.bmr.toFixed(0)} kcal/天</p>
            <p><span className="font-medium">TDEE:</span> {metrics.tdee.toFixed(0)} kcal/天</p>
            <p><span className="font-medium">建议摄入:</span> {metrics.dailyCalorieLimit.toFixed(0)} kcal/天</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
        <User className="mr-2" size={24} />
        {profile ? '编辑个人档案' : '创建个人档案'}
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">性别</label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="male">男</option>
              <option value="female">女</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">年龄 (岁)</label>
            <input
              type="number"
              name="age"
              value={formData.age}
              onChange={handleInputChange}
              min="1"
              max="120"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">身高 (cm)</label>
            <input
              type="number"
              name="height"
              value={formData.height}
              onChange={handleInputChange}
              min="100"
              max="250"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">体重 (kg)</label>
            <input
              type="number"
              name="weight"
              value={formData.weight}
              onChange={handleInputChange}
              min="30"
              max="200"
              step="0.1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
            <Activity className="mr-1" size={16} />
            日常活动强度
          </label>
          <select
            name="activityLevel"
            value={formData.activityLevel}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            {activityLevels.map(level => (
              <option key={level.value} value={level.value}>
                {level.label} - {level.description}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">目标热量缺口 (kcal)</label>
          <input
            type="number"
            name="calorieDeficit"
            value={formData.calorieDeficit}
            onChange={handleInputChange}
            min="0"
            max="1000"
            step="50"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <p className="text-sm text-gray-500 mt-1">建议每日500kcal的热量缺口，可安全减重约0.5kg/周</p>
        </div>
        
        <button
          type="submit"
          className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          {profile ? '更新档案' : '保存档案'}
        </button>
      </form>
    </div>
  );
};

export default UserProfile;
