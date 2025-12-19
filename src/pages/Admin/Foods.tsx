import React, { useState, useEffect } from 'react';
import { getAllFoods, addFoodToLibrary, deleteFoodFromLibrary, FoodLibraryItem } from '../../services/bmob';
import { Search, Plus, Trash2, Utensils } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const AdminFoods = () => {
  const [foods, setFoods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Add Food Form State
  const [newFood, setNewFood] = useState<Partial<FoodLibraryItem>>({
    name: '',
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    unit: '100g'
  });

  const fetchFoods = async () => {
    setLoading(true);
    try {
      const data = await getAllFoods(0, 100);
      setFoods(data);
    } catch (error) {
      console.error('Failed to fetch foods:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFoods();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个食物吗？')) return;
    try {
      await deleteFoodFromLibrary(id);
      setFoods(foods.filter(f => f.objectId !== id));
    } catch (error) {
      alert('删除失败');
    }
  };

  const handleAddFood = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!newFood.name || !newFood.calories) return;
      
      await addFoodToLibrary(newFood as FoodLibraryItem);
      setIsAddModalOpen(false);
      setNewFood({ name: '', calories: 0, protein: 0, fat: 0, carbs: 0, unit: '100g' });
      fetchFoods(); // Refresh list
    } catch (error) {
      alert('添加失败');
      console.error(error);
    }
  };

  const filteredFoods = foods.filter(f => 
    f.name && f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">食物管理</h2>
        <div className="flex gap-4">
            <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
                type="text" 
                placeholder="搜索食物..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            </div>
            <button 
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
                <Plus size={20} />
                添加食物
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
            <div className="col-span-full text-center py-12 text-slate-500">加载中...</div>
        ) : filteredFoods.map(food => (
            <div key={food.objectId} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex justify-between items-start group hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Utensils size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">{food.name}</h3>
                        <div className="text-xs text-slate-500 mt-1 space-x-2">
                            <span>{food.calories} kcal/{food.unit}</span>
                        </div>
                        <div className="flex gap-2 mt-2 text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded w-fit">
                            <span>P: {food.protein}</span>
                            <span>F: {food.fat}</span>
                            <span>C: {food.carbs}</span>
                        </div>
                    </div>
                </div>
                <button 
                    onClick={() => handleDelete(food.objectId)}
                    className="text-slate-300 hover:text-red-500 p-1 rounded opacity-0 group-hover:opacity-100 transition-all"
                >
                    <Trash2 size={18} />
                </button>
            </div>
        ))}
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsAddModalOpen(false)}
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                />
                <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="relative bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl"
                >
                    <h3 className="text-xl font-bold mb-4">添加新食物</h3>
                    <form onSubmit={handleAddFood} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">食物名称</label>
                            <input 
                                type="text" 
                                required
                                value={newFood.name}
                                onChange={e => setNewFood({...newFood, name: e.target.value})}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">单位 (如: 100g)</label>
                                <input 
                                    type="text" 
                                    required
                                    value={newFood.unit}
                                    onChange={e => setNewFood({...newFood, unit: e.target.value})}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">热量 (kcal)</label>
                                <input 
                                    type="number" 
                                    required
                                    value={newFood.calories}
                                    onChange={e => setNewFood({...newFood, calories: Number(e.target.value)})}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">蛋白质 (g)</label>
                                <input 
                                    type="number" 
                                    step="0.1"
                                    value={newFood.protein}
                                    onChange={e => setNewFood({...newFood, protein: Number(e.target.value)})}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">脂肪 (g)</label>
                                <input 
                                    type="number" 
                                    step="0.1"
                                    value={newFood.fat}
                                    onChange={e => setNewFood({...newFood, fat: Number(e.target.value)})}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">碳水 (g)</label>
                                <input 
                                    type="number" 
                                    step="0.1"
                                    value={newFood.carbs}
                                    onChange={e => setNewFood({...newFood, carbs: Number(e.target.value)})}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>
                        </div>
                        
                        <div className="flex justify-end gap-3 mt-6">
                            <button 
                                type="button"
                                onClick={() => setIsAddModalOpen(false)}
                                className="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
                            >
                                取消
                            </button>
                            <button 
                                type="submit"
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                确认添加
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminFoods;
