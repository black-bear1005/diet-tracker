import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks, isToday, addDays, subDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { DailyRecord, FoodItem, ExerciseItem } from '../types';
import { updateDailyRecord, getDailyRecord } from '../utils/storage';
import { estimateExerciseCalories } from '../utils/calculations';
import { addPoints } from '../services/bmob';
import { useToast } from './Toast';
import { Calendar as CalendarIcon, Plus, Trash2, Utensils, Dumbbell, Scale, ChevronLeft, ChevronRight, RotateCcw, Check } from 'lucide-react';
import FoodSearchModal from './FoodSearchModal';
import { motion, AnimatePresence } from 'framer-motion';

interface DailyLoggerProps {
  userProfile: any;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

const DailyLogger: React.FC<DailyLoggerProps> = ({ userProfile, selectedDate, onDateChange }) => {
  const { showToast } = useToast();
  const [dailyRecord, setDailyRecord] = useState<DailyRecord>({
    date: format(selectedDate, 'yyyy-MM-dd'),
    foods: [],
    exercises: [],
    weight: undefined
  });

  const [activeTab, setActiveTab] = useState<'food' | 'exercise'>('food');
  const [isFoodModalOpen, setIsFoodModalOpen] = useState(false);
  const [newExercise, setNewExercise] = useState({ name: '', duration: 0, calories: 0 });
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(selectedDate, { weekStartsOn: 0 }));
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 当外部选中的日期变化时，自动跳转到该日期所在的周
  useEffect(() => {
    setCurrentWeekStart(startOfWeek(selectedDate, { weekStartsOn: 0 }));
  }, [selectedDate]);

  // 自动滚动到选中的日期或今天
  useEffect(() => {
    if (scrollRef.current) {
      const selectedElement = scrollRef.current.querySelector('[data-selected="true"]');
      if (selectedElement) {
        selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else {
          // Fallback: try to find today
           const todayElement = scrollRef.current.querySelector('[data-today="true"]');
           if (todayElement) {
               todayElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
           }
      }
    }
  }, [currentWeekStart, selectedDate]);


  useEffect(() => {
    const run = async () => {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const existingRecord = await getDailyRecord(dateStr);
      if (existingRecord) {
        setDailyRecord(existingRecord);
      } else {
        setDailyRecord({
          date: dateStr,
          foods: [],
          exercises: [],
          weight: undefined
        });
      }
    };
    run();
  }, [selectedDate]);

  const getDaysToDisplay = () => {
    // 显示前一周、当前周、后一周 (共3周)
    const start = subWeeks(currentWeekStart, 1);
    const end = endOfWeek(addWeeks(currentWeekStart, 1), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  };

  const handleAddFood = async (food: FoodItem) => {
    const updatedRecord = { ...dailyRecord, foods: [...dailyRecord.foods, food] };
    setDailyRecord(updatedRecord);
    await updateDailyRecord(updatedRecord);
  };

  const addExercise = async () => {
    if (newExercise.name && newExercise.duration > 0) {
      let calories = newExercise.calories;
      if (calories === 0 && userProfile) {
        calories = estimateExerciseCalories(newExercise.name, newExercise.duration, userProfile.weight);
      }
      
      const exercise: ExerciseItem = {
        id: Date.now().toString(),
        name: newExercise.name,
        duration: newExercise.duration,
        calories: calories
      };
      const updatedRecord = { ...dailyRecord, exercises: [...dailyRecord.exercises, exercise] };
      setDailyRecord(updatedRecord);
      await updateDailyRecord(updatedRecord);
      setNewExercise({ name: '', duration: 0, calories: 0 });
    }
  };

  const removeFood = async (id: string) => {
    const updatedRecord = { ...dailyRecord, foods: dailyRecord.foods.filter(f => f.id !== id) };
    setDailyRecord(updatedRecord);
    await updateDailyRecord(updatedRecord);
  };

  const removeExercise = async (id: string) => {
    const updatedRecord = { ...dailyRecord, exercises: dailyRecord.exercises.filter(e => e.id !== id) };
    setDailyRecord(updatedRecord);
    await updateDailyRecord(updatedRecord);
  };

  const updateWeight = async (weight: number) => {
    const updatedRecord = { ...dailyRecord, weight };
    setDailyRecord(updatedRecord);
    await updateDailyRecord(updatedRecord);
  };

  const totalFoodCalories = dailyRecord.foods.reduce((sum, food) => sum + food.calories, 0);
  const totalExerciseCalories = dailyRecord.exercises.reduce((sum, exercise) => sum + exercise.calories, 0);
  const remainingCalories = userProfile ? userProfile.dailyCalorieLimit - totalFoodCalories : 0;

  return (
    <div className="backdrop-blur-xl bg-white/80 border border-white/20 shadow-lg shadow-blue-500/5 rounded-2xl p-6 pt-safe-top">
      <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
        <CalendarIcon className="mr-2" size={24} />
        每日记录
      </h2>

      {/* 3-Week Scrollable Calendar Strip */}
      <div className="mb-8 bg-transparent rounded-xl shadow-none p-0">
        <div className="flex justify-between items-center mb-4 px-2">
          <div className="flex items-center space-x-2">
             <h3 className="text-lg font-bold text-gray-800">
              {format(selectedDate, 'yyyy年MM月', { locale: zhCN })}
            </h3>
          </div>
          
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
                const today = new Date();
                onDateChange(today);
                setCurrentWeekStart(startOfWeek(today, { weekStartsOn: 0 }));
            }}
            className="flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 rounded-full hover:bg-blue-50 transition-colors"
          >
            <RotateCcw size={14} className="mr-1.5" />
            回到今天
          </motion.button>
        </div>
        
        <div 
            ref={scrollRef}
            className="flex overflow-x-auto snap-x space-x-2 pb-4 hide-scrollbar"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {getDaysToDisplay().map(day => {
            const isSelected = isSameDay(day, selectedDate);
            const isTodayDate = isToday(day);
            
            return (
              <motion.button
                key={day.toISOString()}
                data-selected={isSelected}
                data-today={isTodayDate}
                onClick={() => onDateChange(day)}
                whileTap={{ scale: 0.9 }}
                className={`flex-shrink-0 snap-center flex flex-col items-center justify-center w-14 py-2 transition-all duration-200 rounded-xl ${
                    !isSelected ? 'hover:bg-white/50' : ''
                }`}
              >
                <span className={`text-xs mb-2 font-medium ${isSelected ? 'text-blue-600' : 'text-gray-400'}`}>
                  {format(day, 'EEE', { locale: zhCN })}
                </span>
                
                <div className={`w-10 h-10 flex items-center justify-center rounded-full text-lg font-bold transition-all ${
                    isSelected 
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-110' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}>
                    {format(day, 'd')}
                </div>

                {isTodayDate && !isSelected && (
                  <div className="mt-2 w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                )}
                {!isTodayDate && !isSelected && (
                     <div className="mt-2 w-1.5 h-1.5 rounded-full bg-transparent"></div>
                )}
              </motion.button>
            );
          })}
        </div>
        <div className="h-px bg-gray-100/50 w-full"></div>
      </div>

      {/* Overview Grid: Net Intake */}
      <div className="mb-6">
        {/* Net Intake Card */}
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white relative overflow-hidden shadow-lg shadow-blue-500/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div>
              <h4 className="text-blue-100 text-sm font-medium mb-1">今日净摄入</h4>
              <div className="text-4xl font-bold tracking-tight">
                {totalFoodCalories - totalExerciseCalories}
                <span className="text-lg font-normal text-blue-100 ml-1">kcal</span>
              </div>
            </div>
            <div className="flex gap-6 mt-4">
              <div>
                <div className="text-xs text-blue-100 mb-0.5">总摄入</div>
                <div className="font-semibold text-lg">{totalFoodCalories}</div>
              </div>
              <div>
                <div className="text-xs text-blue-100 mb-0.5">运动消耗</div>
                <div className="font-semibold text-lg">{totalExerciseCalories}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="grid grid-cols-2 gap-2 bg-gray-100/50 p-1 rounded-xl mb-6">
        <button
          onClick={() => setActiveTab('food')}
          className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'food' 
              ? 'bg-white text-blue-600 shadow-sm' 
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <Utensils size={18} />
          饮食记录
        </button>
        <button
          onClick={() => setActiveTab('exercise')}
          className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'exercise' 
              ? 'bg-white text-orange-500 shadow-sm' 
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <Dumbbell size={18} />
          运动打卡
        </button>
      </div>

      {/* Weight Card Removed from here */}
 
       {/* Content Area */}
      <AnimatePresence mode="wait">
        {activeTab === 'food' ? (
          <motion.div
            key="food"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="backdrop-blur-xl bg-white/80 border border-white/20 shadow-sm rounded-2xl p-6"
          >
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="p-2 bg-green-50 rounded-xl mr-3 text-green-600">
                    <Utensils size={20} />
                  </div>
                  饮食摄入
                </div>
                <span className="text-xs font-medium bg-gray-100 text-slate-500 px-2 py-1 rounded-lg">
                  目标: {userProfile?.dailyCalorieLimit}
                </span>
              </h3>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600 font-medium">今日已摄入</span>
                  <span className={`${remainingCalories < 0 ? 'text-red-500' : 'text-green-600'} font-bold`}>
                    {totalFoodCalories} kcal
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <motion.div 
                    className={`h-full rounded-full ${
                      remainingCalories < 0 ? 'bg-red-500' : 'bg-green-500'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((totalFoodCalories / (userProfile?.dailyCalorieLimit || 2000)) * 100, 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
                <div className="text-xs text-right mt-1 text-slate-400">
                  剩余额度: {remainingCalories} kcal
                </div>
              </div>

              {/* Action Bar */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsFoodModalOpen(true)}
                className="w-full mb-4 py-3 bg-green-50 text-green-600 rounded-xl border border-green-100 hover:bg-green-100 transition-colors flex items-center justify-center font-bold gap-2 text-sm"
              >
                <Plus size={18} />
                添加食物
              </motion.button>

              {/* List */}
              <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {dailyRecord.foods.map(food => (
                  <div key={food.id} className="group flex justify-between items-center p-2 hover:bg-gray-50 rounded-xl border border-transparent hover:border-gray-100 transition-all">
                    <div className="flex items-center gap-3">
                      <div 
                        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden ${food.image ? 'cursor-zoom-in' : 'bg-green-100/50 text-green-600'}`}
                        onClick={() => food.image && setPreviewImage(food.image)}
                      >
                        {food.image ? (
                          <img src={food.image} alt={food.name} className="w-full h-full object-cover" />
                        ) : (
                          <Utensils size={16} />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-slate-700 text-sm flex items-center gap-2">
                          {food.name}
                          {food.servingSize && <span className="text-[10px] font-normal text-slate-400 bg-gray-100 px-1.5 py-0.5 rounded">{food.servingSize}</span>}
                        </div>
                        {(food.protein !== undefined || food.fat !== undefined || food.carbs !== undefined) && (
                          <div className="text-[10px] text-slate-400 flex gap-2">
                            {food.protein !== undefined && <span>P: {food.protein}</span>}
                            {food.fat !== undefined && <span>F: {food.fat}</span>}
                            {food.carbs !== undefined && <span>C: {food.carbs}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-700 text-sm">{food.calories} <span className="text-[10px] font-normal text-slate-400">kcal</span></span>
                      <button
                        onClick={() => removeFood(food.id)}
                        className="p-1.5 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {dailyRecord.foods.length === 0 && (
                  <div className="text-center py-12 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 text-slate-400 text-xs">
                    暂无记录，快去添加第一餐吧
                  </div>
                )}

              </div>
          </motion.div>
        ) : (
          <motion.div
            key="exercise"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="backdrop-blur-xl bg-white/80 border border-white/20 shadow-sm rounded-2xl p-6"
          >
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                <div className="p-2 bg-orange-50 rounded-xl mr-3 text-orange-600">
                  <Dumbbell size={20} />
                </div>
                运动打卡
              </h3>

              {/* Input Group with Quick Chips */}
              <div className="mb-6 space-y-4">
                {/* Quick Chips */}
                <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                  {['跑步', '散步', '瑜伽', '跳绳', '帕梅拉', '游泳', '骑行'].map(sport => (
                    <button
                      key={sport}
                      onClick={() => setNewExercise(prev => ({ ...prev, name: sport }))}
                      className="px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-xs font-bold border border-orange-100 whitespace-nowrap hover:bg-orange-100 transition-colors"
                    >
                      {sport}
                    </button>
                  ))}
                </div>

                {/* Input Fields Row */}
                <div className="grid grid-cols-[1.5fr_1fr_1fr] gap-2">
                  <input
                    type="text"
                    placeholder="项目"
                    value={newExercise.name}
                    onChange={(e) => setNewExercise({ ...newExercise, name: e.target.value })}
                    className="w-full px-3 py-3 bg-white border-b-2 border-gray-100 focus:border-orange-500 focus:outline-none text-slate-700 placeholder-slate-400 font-bold text-sm transition-colors rounded-t-lg"
                  />
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={newExercise.duration || ''}
                      onChange={(e) => setNewExercise({ ...newExercise, duration: Number(e.target.value) })}
                      min="0"
                      className="w-full px-3 py-3 bg-white border-b-2 border-gray-100 focus:border-orange-500 focus:outline-none text-slate-700 text-center placeholder-slate-400 font-bold text-sm transition-colors rounded-t-lg"
                    />
                    <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">min</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={newExercise.calories || ''}
                      onChange={(e) => setNewExercise({ ...newExercise, calories: Number(e.target.value) })}
                      min="0"
                      className="w-full px-3 py-3 bg-white border-b-2 border-gray-100 focus:border-orange-500 focus:outline-none text-slate-700 text-center placeholder-slate-400 font-bold text-sm transition-colors rounded-t-lg"
                    />
                    <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">kcal</span>
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={addExercise}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl hover:from-orange-600 hover:to-red-600 shadow-lg shadow-orange-500/30 transition-all font-bold text-sm flex items-center justify-center gap-2"
                >
                  <Check size={16} />
                  确认打卡
                </motion.button>
              </div>

              {/* List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {dailyRecord.exercises.map(exercise => (
                  <div key={exercise.id} className="group flex justify-between items-center p-3 bg-white/50 border border-gray-100 rounded-xl hover:shadow-sm transition-all">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-orange-100/50 flex items-center justify-center mr-3 text-orange-600 font-bold text-sm">
                        {exercise.name.slice(0,1)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-700 text-sm">{exercise.name}</div>
                        <div className="text-xs text-slate-400">{exercise.duration} 分钟</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-orange-500 text-sm">-{exercise.calories} kcal</span>
                      <button
                        onClick={() => removeExercise(exercise.id)}
                        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {dailyRecord.exercises.length === 0 && (
                  <div className="col-span-full text-center py-12 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 text-slate-400 text-xs">
                    今天还没有运动，动起来吧！
                  </div>
                )}
              </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Weight Card (Fixed at bottom) */}
      <div className="bg-gradient-to-br from-white to-blue-50/50 border border-gray-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden mt-6">
             <div className="absolute -right-6 -bottom-6 w-32 h-32 text-blue-500/5 rotate-12 pointer-events-none">
                <Scale className="w-full h-full" />
             </div>
             <div className="relative z-10">
                <h4 className="text-gray-500 text-sm font-medium mb-1 flex items-center gap-2">
                    今日体重
                </h4>
                <div className="flex items-baseline mt-2">
                    <input
                        type="number"
                        inputMode="decimal"
                        placeholder="0.0"
                        value={dailyRecord.weight || ''}
                        onChange={(e) => updateWeight(Number(e.target.value))}
                        className="text-4xl font-bold text-slate-800 bg-transparent border-none focus:outline-none w-24 p-0 placeholder-gray-200 z-10 relative"
                    />
                    <span className="text-gray-400 ml-1">kg</span>
                </div>
             </div>
             <p className="text-xs text-gray-400 mt-2 relative z-10">
                {dailyRecord.weight ? '已记录' : '建议晨起空腹称重'}
             </p>
      </div>
      
      <FoodSearchModal
        isOpen={isFoodModalOpen}
        onClose={() => setIsFoodModalOpen(false)}
        onSave={handleAddFood}
      />
      
      {/* Full Screen Image Preview - Portaled to Body */}
      {createPortal(
        <AnimatePresence>
          {previewImage && (
              <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out backdrop-blur-sm"
                  onClick={() => setPreviewImage(null)}
              >
                  <motion.img
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0.8 }}
                      src={previewImage}
                      alt="Food Preview"
                      className="max-w-full max-h-full object-contain rounded-lg shadow-2xl pointer-events-none"
                  />
              </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default DailyLogger;
