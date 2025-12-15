import React, { useState, useEffect } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { DailyRecord, FoodItem, ExerciseItem } from '../types';
import { updateDailyRecord, getDailyRecord } from '../utils/storage';
import { estimateExerciseCalories } from '../utils/calculations';
import { Calendar, Plus, Trash2, Utensils, Dumbbell, Scale } from 'lucide-react';

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

  const [newFood, setNewFood] = useState({ name: '', calories: 0 });
  const [newExercise, setNewExercise] = useState({ name: '', duration: 0, calories: 0 });
  const [currentMonth, setCurrentMonth] = useState(selectedDate);

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

  const getDaysInMonth = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  };

  const addFood = async () => {
    if (newFood.name && newFood.calories > 0) {
      const food: FoodItem = {
        id: Date.now().toString(),
        name: newFood.name,
        calories: newFood.calories
      };
      const updatedRecord = { ...dailyRecord, foods: [...dailyRecord.foods, food] };
      setDailyRecord(updatedRecord);
      await updateDailyRecord(updatedRecord);
      setNewFood({ name: '', calories: 0 });
    }
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
      <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
        <Calendar className="mr-2" size={24} />
        每日记录
      </h2>

      {/* Calendar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            className="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
          >
            ←
          </button>
          <h3 className="text-lg font-medium">
            {format(currentMonth, 'yyyy年MM月')}
          </h3>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            className="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
          >
            →
          </button>
        </div>
        
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['日', '一', '二', '三', '四', '五', '六'].map(day => (
            <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {getDaysInMonth().map(day => (
            <button
              key={day.toISOString()}
              onClick={() => onDateChange(day)}
              className={`p-2 text-sm rounded-md transition-colors ${
                isSameDay(day, selectedDate)
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {format(day, 'd')}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Date */}
      <div className="mb-4 p-3 bg-blue-50 rounded-md">
        <p className="text-blue-800 font-medium">
          选中日期: {format(selectedDate, 'yyyy年MM月dd日')}
        </p>
      </div>

      {/* Weight Recording */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-3 flex items-center">
          <Scale className="mr-2" size={20} />
          体重记录
        </h3>
        <div className="flex items-center gap-3">
          <input
            type="number"
            placeholder="今日体重 (kg)"
            value={dailyRecord.weight || ''}
            onChange={(e) => updateWeight(Number(e.target.value))}
            min="30"
            max="200"
            step="0.1"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-gray-600">kg</span>
        </div>
      </div>

      {/* Food Intake */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-3 flex items-center">
          <Utensils className="mr-2" size={20} />
          饮食摄入
        </h3>
        
        <div className="mb-3 p-3 bg-yellow-50 rounded-md">
          <div className="flex justify-between text-sm">
            <span>今日已摄入:</span>
            <span className="font-medium">{totalFoodCalories} kcal</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>剩余可摄入:</span>
            <span className={`font-medium ${remainingCalories < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {remainingCalories} kcal
            </span>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="食物名称"
            value={newFood.name}
            onChange={(e) => setNewFood({ ...newFood, name: e.target.value })}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="number"
            placeholder="热量 (kcal)"
            value={newFood.calories || ''}
            onChange={(e) => setNewFood({ ...newFood, calories: Number(e.target.value) })}
            min="0"
            className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addFood}
            className="px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="space-y-2">
          {dailyRecord.foods.map(food => (
            <div key={food.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-md">
              <span>{food.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">{food.calories} kcal</span>
                <button
                  onClick={() => removeFood(food.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Exercise */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-3 flex items-center">
          <Dumbbell className="mr-2" size={20} />
          运动打卡
        </h3>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="运动项目"
            value={newExercise.name}
            onChange={(e) => setNewExercise({ ...newExercise, name: e.target.value })}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="number"
            placeholder="时长 (分钟)"
            value={newExercise.duration || ''}
            onChange={(e) => setNewExercise({ ...newExercise, duration: Number(e.target.value) })}
            min="0"
            className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="number"
            placeholder="消耗 (kcal)"
            value={newExercise.calories || ''}
            onChange={(e) => setNewExercise({ ...newExercise, calories: Number(e.target.value) })}
            min="0"
            className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addExercise}
            className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="text-xs text-gray-500 mb-3">
          提示：如果消耗热量为0，系统会根据体重和运动类型自动估算
        </div>

        <div className="space-y-2">
          {dailyRecord.exercises.map(exercise => (
            <div key={exercise.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-md">
              <div>
                <span>{exercise.name}</span>
                <span className="text-sm text-gray-600 ml-2">{exercise.duration}分钟</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">{exercise.calories} kcal</span>
                <button
                  onClick={() => removeExercise(exercise.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="p-4 bg-gray-50 rounded-md">
        <h4 className="font-medium mb-2">今日总结</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">总摄入:</span>
            <span className="ml-1 font-medium">{totalFoodCalories} kcal</span>
          </div>
          <div>
            <span className="text-gray-600">运动消耗:</span>
            <span className="ml-1 font-medium">{totalExerciseCalories} kcal</span>
          </div>
          <div>
            <span className="text-gray-600">净摄入:</span>
            <span className="ml-1 font-medium">{totalFoodCalories - totalExerciseCalories} kcal</span>
          </div>
          <div>
            <span className="text-gray-600">体重:</span>
            <span className="ml-1 font-medium">{dailyRecord.weight ? `${dailyRecord.weight} kg` : '未记录'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyLogger;
