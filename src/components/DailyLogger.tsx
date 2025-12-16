import React, { useState, useEffect } from 'react';
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks, isToday } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { DailyRecord, FoodItem, ExerciseItem } from '../types';
import { updateDailyRecord, getDailyRecord } from '../utils/storage';
import { estimateExerciseCalories } from '../utils/calculations';
import { Calendar as CalendarIcon, Plus, Trash2, Utensils, Dumbbell, Scale, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import FoodSearchModal from './FoodSearchModal';

interface DailyLoggerProps {
  userProfile: any;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

const DailyLogger: React.FC<DailyLoggerProps> = ({ userProfile, selectedDate, onDateChange }) => {
  const [dailyRecord, setDailyRecord] = useState<DailyRecord>({
    date: format(selectedDate, 'yyyy-MM-dd'),
    foods: [],
    exercises: [],
    weight: undefined
  });

  const [isFoodModalOpen, setIsFoodModalOpen] = useState(false);
  const [newExercise, setNewExercise] = useState({ name: '', duration: 0, calories: 0 });
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(selectedDate, { weekStartsOn: 0 }));

  // 当外部选中的日期变化时，自动跳转到该日期所在的周
  useEffect(() => {
    setCurrentWeekStart(startOfWeek(selectedDate, { weekStartsOn: 0 }));
  }, [selectedDate]);

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

  const getDaysInWeek = () => {
    const start = currentWeekStart;
    const end = endOfWeek(currentWeekStart, { weekStartsOn: 0 });
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
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
        <CalendarIcon className="mr-2" size={24} />
        每日记录
      </h2>

      {/* Weekly Calendar Strip */}
      <div className="mb-8 bg-white rounded-xl shadow-sm p-4 border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <h3 className="text-lg font-bold text-gray-800">
              {format(currentWeekStart, 'yyyy年MM月', { locale: zhCN })}
            </h3>
            <button
              onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          
          <button
            onClick={() => onDateChange(new Date())}
            className="flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 rounded-full hover:bg-blue-50 transition-colors"
          >
            <RotateCcw size={14} className="mr-1.5" />
            回到今天
          </button>
        </div>
        
        <div className="grid grid-cols-7 gap-2">
          {getDaysInWeek().map(day => {
            const isSelected = isSameDay(day, selectedDate);
            const isTodayDate = isToday(day);
            
            return (
              <button
                key={day.toISOString()}
                onClick={() => onDateChange(day)}
                className={`flex flex-col items-center justify-center py-3 rounded-2xl transition-all duration-200 ${
                  isSelected
                    ? 'bg-blue-500 text-white shadow-md transform scale-105'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <span className={`text-xs mb-1 font-medium ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                  {format(day, 'EEE', { locale: zhCN })}
                </span>
                <span className={`text-lg font-bold ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                  {format(day, 'd')}
                </span>
                {isTodayDate && !isSelected && (
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary Bar (Moved to Top) */}
      <div className="mb-6 bg-gray-900 text-white rounded-2xl shadow-lg p-6 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h4 className="text-gray-400 text-sm mb-1">今日净摄入</h4>
          <div className="text-3xl font-bold flex items-baseline">
            {totalFoodCalories - totalExerciseCalories}
            <span className="text-sm font-normal text-gray-500 ml-2">kcal</span>
          </div>
        </div>
        
        <div className="h-10 w-px bg-gray-700 hidden sm:block"></div>
        
        <div className="flex gap-8">
           <div>
            <h4 className="text-gray-400 text-xs mb-1">总摄入</h4>
            <div className="text-xl font-semibold text-green-400">{totalFoodCalories}</div>
          </div>
          <div>
            <h4 className="text-gray-400 text-xs mb-1">运动消耗</h4>
            <div className="text-xl font-semibold text-orange-400">{totalExerciseCalories}</div>
          </div>
           <div>
            <h4 className="text-gray-400 text-xs mb-1">当前体重</h4>
            <div className="text-xl font-semibold text-blue-400">
              {dailyRecord.weight ? dailyRecord.weight : '--'} <span className="text-xs text-gray-500">kg</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 1. Weight Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow lg:col-span-1">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg mr-3">
              <Scale className="text-blue-600" size={20} />
            </div>
            体重记录
          </h3>
          <div className="flex flex-col items-center justify-center py-4">
            <div className="relative flex items-baseline">
              <input
                type="number"
                placeholder="0.0"
                value={dailyRecord.weight || ''}
                onChange={(e) => updateWeight(Number(e.target.value))}
                min="30"
                max="200"
                step="0.1"
                className="text-5xl font-bold text-gray-800 text-center bg-transparent border-b-2 border-gray-200 focus:border-blue-500 focus:outline-none w-40 pb-2 transition-colors placeholder-gray-300"
              />
              <span className="text-xl text-gray-500 ml-2 font-medium">kg</span>
            </div>
            <p className="text-sm text-gray-400 mt-4">建议每天早晨空腹称重</p>
          </div>
        </div>

        {/* 2. Food Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow lg:col-span-2">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg mr-3">
                <Utensils className="text-green-600" size={20} />
              </div>
              饮食摄入
            </div>
            <span className="text-sm font-medium text-gray-500">
              目标: {userProfile?.dailyCalorieLimit}
            </span>
          </h3>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 font-medium">今日已摄入</span>
              <span className={`${remainingCalories < 0 ? 'text-red-500' : 'text-green-600'} font-bold`}>
                {totalFoodCalories} kcal
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  remainingCalories < 0 ? 'bg-red-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min((totalFoodCalories / (userProfile?.dailyCalorieLimit || 2000)) * 100, 100)}%` }}
              ></div>
            </div>
            <div className="text-xs text-right mt-1 text-gray-400">
              剩余额度: {remainingCalories} kcal
            </div>
          </div>

          {/* Action Bar */}
          <button
            onClick={() => setIsFoodModalOpen(true)}
            className="w-full mb-4 py-3 bg-green-50 text-green-600 rounded-xl border border-green-100 hover:bg-green-100 transition-colors flex items-center justify-center font-bold gap-2"
          >
            <Plus size={20} />
            添加食物
          </button>

          {/* List */}
          <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
            {dailyRecord.foods.map(food => (
              <div key={food.id} className="group flex justify-between items-center p-3 hover:bg-gray-50 rounded-xl border border-transparent hover:border-gray-100 transition-all">
                <div>
                  <div className="font-bold text-gray-700 flex items-center gap-2">
                    {food.name}
                    {food.servingSize && <span className="text-xs font-normal text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{food.servingSize}</span>}
                  </div>
                  {(food.protein !== undefined || food.fat !== undefined || food.carbs !== undefined) && (
                    <div className="text-xs text-gray-400 mt-1 flex gap-2">
                      {food.protein !== undefined && <span>P: {food.protein}</span>}
                      {food.fat !== undefined && <span>F: {food.fat}</span>}
                      {food.carbs !== undefined && <span>C: {food.carbs}</span>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-700">{food.calories} <span className="text-xs font-normal text-gray-400">kcal</span></span>
                  <button
                    onClick={() => removeFood(food.id)}
                    className="p-1.5 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {dailyRecord.foods.length === 0 && (
              <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 text-sm">
                暂无记录，快去添加第一餐吧
              </div>
            )}
          </div>
        </div>

        {/* 3. Exercise Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow lg:col-span-3">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg mr-3">
              <Dumbbell className="text-orange-600" size={20} />
            </div>
            运动打卡
          </h3>

          {/* Input Group */}
          <div className="flex flex-wrap gap-2 mb-6">
            <div className="flex-[2] bg-gray-50 rounded-xl border border-gray-200 focus-within:ring-2 focus-within:ring-orange-500 focus-within:border-transparent transition-all overflow-hidden">
              <input
                type="text"
                placeholder="运动项目"
                value={newExercise.name}
                onChange={(e) => setNewExercise({ ...newExercise, name: e.target.value })}
                className="w-full px-4 py-3 bg-transparent focus:outline-none text-gray-700"
              />
            </div>
            <div className="flex-1 bg-gray-50 rounded-xl border border-gray-200 focus-within:ring-2 focus-within:ring-orange-500 focus-within:border-transparent transition-all overflow-hidden flex items-center">
               <input
                type="number"
                placeholder="分钟"
                value={newExercise.duration || ''}
                onChange={(e) => setNewExercise({ ...newExercise, duration: Number(e.target.value) })}
                min="0"
                className="w-full px-3 py-3 bg-transparent focus:outline-none text-gray-700 text-center"
              />
            </div>
            <div className="flex-1 bg-gray-50 rounded-xl border border-gray-200 focus-within:ring-2 focus-within:ring-orange-500 focus-within:border-transparent transition-all overflow-hidden flex items-center">
               <input
                type="number"
                placeholder="kcal (可选)"
                value={newExercise.calories || ''}
                onChange={(e) => setNewExercise({ ...newExercise, calories: Number(e.target.value) })}
                min="0"
                className="w-full px-3 py-3 bg-transparent focus:outline-none text-gray-700 text-center"
              />
            </div>
            <button
              onClick={addExercise}
              className="px-6 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors shadow-sm active:scale-95 transform font-medium"
            >
              打卡
            </button>
          </div>

          {/* List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {dailyRecord.exercises.map(exercise => (
              <div key={exercise.id} className="group flex justify-between items-center p-4 bg-white border border-gray-100 rounded-xl hover:shadow-sm transition-all">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center mr-3 text-orange-500 font-bold text-sm">
                    {exercise.name.slice(0,1)}
                  </div>
                  <div>
                    <div className="font-bold text-gray-700">{exercise.name}</div>
                    <div className="text-xs text-gray-400">{exercise.duration} 分钟</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-orange-500">-{exercise.calories} kcal</span>
                  <button
                    onClick={() => removeExercise(exercise.id)}
                    className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {dailyRecord.exercises.length === 0 && (
              <div className="col-span-full text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 text-sm">
                今天还没有运动，动起来吧！
              </div>
            )}
          </div>
        </div>
      </div>
      
      <FoodSearchModal
        isOpen={isFoodModalOpen}
        onClose={() => setIsFoodModalOpen(false)}
        onSave={handleAddFood}
      />
    </div>
  );
};

export default DailyLogger;
