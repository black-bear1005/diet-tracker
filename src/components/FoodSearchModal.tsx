import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Check, Utensils, Info } from 'lucide-react';
import { searchFoodLibrary } from '../services/bmob';
import { FoodLibraryItem, FoodItem } from '../types';

interface FoodSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (food: FoodItem) => void;
}

// Helper to parse unit string like "100克" -> { baseAmount: 100, unitLabel: "克" }
const parseUnit = (unitString: string) => {
  if (!unitString) return { baseAmount: 100, unitLabel: '克' };
  const match = unitString.match(/^(\d+)(.*)$/);
  if (match) {
    return { baseAmount: Number(match[1]), unitLabel: match[2] };
  }
  return { baseAmount: 100, unitLabel: unitString };
};

const FoodSearchModal: React.FC<FoodSearchModalProps> = ({ isOpen, onClose, onSave }) => {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<FoodLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodLibraryItem | null>(null);
  const [amount, setAmount] = useState<number>(100);
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualData, setManualData] = useState({
    name: '',
    calories: '',
    protein: '',
    fat: '',
    carbs: ''
  });
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [baseAmount, setBaseAmount] = useState<number>(100);
  const [unit, setUnit] = useState<string>('克');
  
  useEffect(() => {
    if (isOpen && searchInputRef.current && !isManualMode) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, isManualMode]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (keyword.trim()) {
        setLoading(true);
        try {
          const data = await searchFoodLibrary(keyword);
          setResults(data);
        } catch (error) {
          console.error('Search failed:', error);
          setResults([]);
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [keyword]);

  const handleSelectFood = (food: FoodLibraryItem) => {
    setSelectedFood(food);
    const { baseAmount, unitLabel } = parseUnit(food.unit || '克');
    setAmount(baseAmount);
    setBaseAmount(baseAmount);
    setUnit(unitLabel);
  };

  const handleSave = () => {
    if (!selectedFood) return;

    const ratio = amount / baseAmount;
    
    const foodItem: FoodItem = {
      id: Date.now().toString(),
      name: selectedFood.name,
      calories: Math.round(selectedFood.calories * ratio),
      protein: selectedFood.protein ? Number((selectedFood.protein * ratio).toFixed(1)) : 0,
      fat: selectedFood.fat ? Number((selectedFood.fat * ratio).toFixed(1)) : 0,
      carbs: selectedFood.carbs ? Number((selectedFood.carbs * ratio).toFixed(1)) : 0,
      servingSize: `${amount}${unit}`,
      unit: unit
    };

    onSave(foodItem);
    handleClose();
  };

  const handleManualSubmit = () => {
    if (!manualData.name || !manualData.calories) return;

    const foodItem: FoodItem = {
      id: Date.now().toString(),
      name: manualData.name,
      calories: Math.round(Number(manualData.calories)),
      protein: manualData.protein ? Number(manualData.protein) : 0,
      fat: manualData.fat ? Number(manualData.fat) : 0,
      carbs: manualData.carbs ? Number(manualData.carbs) : 0,
      servingSize: '1份',
      unit: '份'
    };

    onSave(foodItem);
    handleClose();
  };

  const handleClose = () => {
    setKeyword('');
    setResults([]);
    setSelectedFood(null);
    setIsManualMode(false);
    setManualData({ name: '', calories: '', protein: '', fat: '', carbs: '' });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        {!isManualMode && (
          <div className="p-4 border-b border-gray-100 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                ref={searchInputRef}
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索食物 (如: 米饭, 鸡蛋...)"
                className="w-full bg-gray-50 border-none rounded-xl py-3 pl-10 pr-10 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
              />
              {keyword && (
                <button 
                  onClick={() => setKeyword('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
              <X size={24} />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isManualMode ? (
            // Manual Entry Form
            <div className="p-6 animate-in slide-in-from-right duration-200">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">手动记录食物</h3>
                <button onClick={() => setIsManualMode(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">食物名称 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={manualData.name}
                    onChange={(e) => setManualData({ ...manualData, name: e.target.value })}
                    placeholder="例如：自制三明治"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">总热量 (kcal) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={manualData.calories}
                    onChange={(e) => setManualData({ ...manualData, calories: e.target.value })}
                    placeholder="0"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-lg"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">蛋白质 (g)</label>
                    <input
                      type="number"
                      value={manualData.protein}
                      onChange={(e) => setManualData({ ...manualData, protein: e.target.value })}
                      placeholder="选填"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">脂肪 (g)</label>
                    <input
                      type="number"
                      value={manualData.fat}
                      onChange={(e) => setManualData({ ...manualData, fat: e.target.value })}
                      placeholder="选填"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">碳水 (g)</label>
                    <input
                      type="number"
                      value={manualData.carbs}
                      onChange={(e) => setManualData({ ...manualData, carbs: e.target.value })}
                      placeholder="选填"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-center"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    onClick={() => setIsManualMode(false)}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleManualSubmit}
                    disabled={!manualData.name || !manualData.calories}
                    className="flex-1 py-3 rounded-xl bg-green-500 text-white font-bold hover:bg-green-600 shadow-lg shadow-green-200 disabled:opacity-50 disabled:shadow-none transition-all"
                  >
                    确认添加
                  </button>
                </div>
              </div>
            </div>
          ) : !selectedFood ? (
            // Search Results List
            <div className="p-2">
              {loading ? (
                <div className="text-center py-10 text-gray-400">正在搜索...</div>
              ) : results.length > 0 ? (
                <div className="space-y-1">
                  {results.map((food) => (
                    <button
                      key={food.objectId || Math.random()}
                      onClick={() => handleSelectFood(food)}
                      className="w-full text-left p-3 hover:bg-blue-50 rounded-xl transition-colors group flex justify-between items-center"
                    >
                      <div>
                        <div className="font-bold text-gray-800 text-lg">{food.name}</div>
                        <div className="text-xs text-gray-400 mt-1 flex gap-3">
                          <span>P: {food.protein}g</span>
                          <span className="w-px h-3 bg-gray-300"></span>
                          <span>F: {food.fat}g</span>
                          <span className="w-px h-3 bg-gray-300"></span>
                          <span>C: {food.carbs}g</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-blue-600 font-bold">{food.calories}</div>
                        <div className="text-xs text-gray-400">大卡/{food.unit}</div>
                      </div>
                    </button>
                  ))}
                  
                  {/* Manual Entry Trigger (in list) */}
                  <div className="pt-2 px-2 pb-4">
                    <button
                      onClick={() => setIsManualMode(true)}
                      className="w-full py-3 text-sm text-blue-600 font-bold bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors border border-blue-100"
                    >
                      找不到想要的食物？<span className="underline">手动添加</span>
                    </button>
                  </div>
                </div>
              ) : keyword ? (
                <div className="text-center py-10 text-gray-400">
                  <Utensils size={48} className="mx-auto mb-2 opacity-20" />
                  未找到相关食物
                  <div className="mt-4 text-xs text-blue-500 cursor-pointer hover:underline" onClick={() => window.location.reload()}>
                    如果是首次使用，请刷新页面初始化数据
                  </div>
                  
                  <div className="mt-6">
                    <button
                      onClick={() => setIsManualMode(true)}
                      className="px-6 py-2 text-sm text-blue-600 font-bold bg-blue-50 rounded-full hover:bg-blue-100 transition-colors border border-blue-100"
                    >
                      手动添加食物
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 text-gray-400">
                  <Search size={48} className="mx-auto mb-2 opacity-20" />
                  输入关键词开始搜索
                </div>
              )}
            </div>
          ) : (
            // Detail / Add View
            <div className="p-6 animate-in slide-in-from-right duration-200">
              <button 
                onClick={() => setSelectedFood(null)}
                className="mb-4 text-sm text-gray-500 hover:text-blue-600 flex items-center"
              >
                ← 返回搜索结果
              </button>
              
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-2xl font-bold text-gray-800">{selectedFood.name}</h3>
                <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                  {selectedFood.calories} 大卡 / {selectedFood.unit}
                </div>
              </div>

              {/* Nutrition Grid */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-orange-50 p-4 rounded-2xl text-center">
                  <div className="text-orange-500 text-xs font-bold mb-1">蛋白质</div>
                  <div className="text-xl font-black text-gray-800">
                    {((selectedFood.protein || 0) * (amount / baseAmount)).toFixed(1)}g
                  </div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-2xl text-center">
                  <div className="text-yellow-600 text-xs font-bold mb-1">脂肪</div>
                  <div className="text-xl font-black text-gray-800">
                    {((selectedFood.fat || 0) * (amount / baseAmount)).toFixed(1)}g
                  </div>
                </div>
                <div className="bg-green-50 p-4 rounded-2xl text-center">
                  <div className="text-green-600 text-xs font-bold mb-1">碳水</div>
                  <div className="text-xl font-black text-gray-800">
                    {((selectedFood.carbs || 0) * (amount / baseAmount)).toFixed(1)}g
                  </div>
                </div>
              </div>

              {/* Amount Input */}
              <div className="bg-gray-50 p-5 rounded-2xl mb-8">
                <label className="block text-sm font-bold text-gray-500 mb-3">
                  摄入分量
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                    className="flex-1 text-3xl font-bold bg-white border border-gray-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-500 outline-none text-center"
                  />
                  <div className="w-20 text-center font-bold text-gray-500">
                    {unit}
                  </div>
                </div>
                <div className="text-center mt-3 text-sm text-gray-400">
                  总热量: <span className="text-gray-800 font-bold text-lg">{Math.round(selectedFood.calories * (amount / baseAmount))}</span> 大卡
                </div>
              </div>

              <button
                onClick={handleSave}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-200 active:transform active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Check size={20} />
                确认添加
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FoodSearchModal;
