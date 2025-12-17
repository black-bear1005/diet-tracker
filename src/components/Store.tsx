import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Package, Crown, Utensils, HelpingHand, Eraser, Film, Coffee, ShieldOff, Loader2, Coins, Gift, Shield, Ticket, Heart, Zap, Shirt, Gamepad2, Mic, Search, Clock, Smile } from 'lucide-react';
import { SHOP_ITEMS } from '../utils/constants';
import { buyItem, getMyInventory, useItem, InventoryItem, getOrCreateUserProfile } from '../services/bmob';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';

const ICON_MAP: Record<string, any> = {
    'Crown': Crown,
    'Utensils': Utensils,
    'HelpingHand': HelpingHand,
    'Eraser': Eraser,
    'Film': Film,
    'Coffee': Coffee,
    'ShieldOff': ShieldOff,
    'Gift': Gift,
    'Shield': Shield,
    'Ticket': Ticket,
    'Heart': Heart,
    'Zap': Zap,
    'Shirt': Shirt,
    'Gamepad2': Gamepad2,
    'Mic': Mic,
    'Search': Search,
    'Clock': Clock,
    'Smile': Smile
};

export default function Store() {
    const [activeTab, setActiveTab] = useState<'buy' | 'bag'>('buy');
    const [loading, setLoading] = useState(false);
    const [points, setPoints] = useState(0);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const { showToast } = useToast();

    // Dialog State
    const [dialogState, setDialogState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        type: 'info' | 'danger' | 'warning';
        confirmText?: string;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
        type: 'info'
    });

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            const profile = await getOrCreateUserProfile();
            setPoints(profile.points || 0);

            if (activeTab === 'bag') {
                const items = await getMyInventory();
                setInventory(items);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const processBuy = async (item: typeof SHOP_ITEMS[0]) => {
        setLoading(true);
        try {
            await buyItem(item.id, item.price);
            showToast(`成功购买 ${item.name}！`, 'success');
            loadData(); // Refresh points
        } catch (e: any) {
            showToast(e.message || '购买失败', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleBuy = (item: typeof SHOP_ITEMS[0]) => {
        setDialogState({
            isOpen: true,
            title: '确认购买',
            message: `确定要花费 ${item.price} 积分购买“${item.name}”吗？`,
            type: 'info',
            confirmText: '确认购买',
            onConfirm: () => processBuy(item)
        });
    };

    const processUse = async (invItem: InventoryItem) => {
        setLoading(true);
        try {
            await useItem(invItem.objectId!, invItem.itemId);
            showToast('道具使用成功！对方已收到强制任务', 'success');
            loadData(); // Refresh inventory
        } catch (e: any) {
            showToast(e.message || '使用失败', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleUse = (invItem: InventoryItem) => {
        setDialogState({
            isOpen: true,
            title: '确认使用',
            message: `确定要使用“${invItem.itemName}”吗？这将给对方发送一个强制任务。`,
            type: 'warning',
            confirmText: '立即使用',
            onConfirm: () => processUse(invItem)
        });
    };

    return (
        <div className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-sm rounded-3xl overflow-hidden min-h-[80vh]">
            {/* Sticky Header with Points */}
            <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-white/50 px-6 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3 text-gray-800 font-black text-lg">
                    <div className="p-2 bg-gradient-to-br from-orange-100 to-amber-100 rounded-xl shadow-inner">
                        <ShoppingBag className="w-5 h-5 text-orange-600" />
                    </div>
                    <span>积分商城</span>
                </div>
                <div className="flex items-center gap-2 bg-white/50 border border-white/60 px-4 py-1.5 rounded-full shadow-sm backdrop-blur-md">
                    <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                        <Coins className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-amber-600 font-black text-lg">{points}</span>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {/* Tabs */}
                <div className="flex p-1.5 bg-gray-100/50 rounded-2xl border border-gray-200/50">
                    <button
                        onClick={() => setActiveTab('buy')}
                        className={`relative flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-xl transition-all ${
                            activeTab === 'buy' ? 'text-gray-800' : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        {activeTab === 'buy' && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute inset-0 bg-white shadow-sm rounded-xl border border-gray-100"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                        <span className="relative z-10 flex items-center gap-2">
                            <ShoppingBag className="w-4 h-4" />
                            兑换道具
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('bag')}
                        className={`relative flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-xl transition-all ${
                            activeTab === 'bag' ? 'text-gray-800' : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        {activeTab === 'bag' && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute inset-0 bg-white shadow-sm rounded-xl border border-gray-100"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                        <span className="relative z-10 flex items-center gap-2">
                            <Package className="w-4 h-4" />
                            我的背包
                        </span>
                    </button>
                </div>

                {/* Content */}
                <AnimatePresence mode="wait">
                    {loading && inventory.length === 0 && activeTab === 'bag' ? (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex justify-center py-12"
                        >
                            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                        </motion.div>
                    ) : (
                        <motion.div 
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="grid grid-cols-2 md:grid-cols-3 gap-3"
                        >
                            {activeTab === 'buy' ? (
                                // Shop Items
                                SHOP_ITEMS.map((item) => {
                                    let Icon = Package;
                                    if (typeof item.icon === 'string') {
                                        Icon = ICON_MAP[item.icon] || Package;
                                    } else if (item.icon) {
                                        Icon = item.icon as any;
                                    }
                                    
                                    const canAfford = points >= item.price;

                                    return (
                                        <motion.div 
                                            layout
                                            key={item.id}
                                            whileHover={{ y: -4 }}
                                            className="group relative bg-white/80 backdrop-blur-md border border-white/60 p-4 rounded-3xl shadow-sm hover:shadow-xl hover:border-orange-100 transition-all duration-300 flex flex-col items-center text-center overflow-hidden"
                                        >
                                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-200 to-amber-200 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            
                                            {/* Large Icon Circle */}
                                            <div className="w-16 h-16 mb-3 rounded-full bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300 border border-orange-50">
                                                <Icon className="w-8 h-8 text-orange-500" strokeWidth={1.5} />
                                            </div>

                                            <h3 className="font-bold text-gray-800 text-sm mb-1 line-clamp-1">{item.name}</h3>
                                            <p className="text-[10px] text-gray-400 mb-4 line-clamp-2 min-h-[2.5em] leading-relaxed w-full px-1">{item.desc}</p>
                                            
                                            <div className="w-full mt-auto flex items-center justify-between bg-gray-50/50 p-1.5 rounded-full border border-gray-100">
                                                <div className="pl-2 font-black text-orange-600 text-sm flex items-center gap-1">
                                                    <Coins size={12} className="text-orange-500" />
                                                    {item.price}
                                                </div>
                                                <motion.button
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => handleBuy(item)}
                                                    disabled={!canAfford || loading}
                                                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all shadow-sm ${
                                                        canAfford 
                                                            ? 'bg-gradient-to-r from-orange-400 to-red-500 text-white shadow-orange-500/20 hover:shadow-orange-500/40' 
                                                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                    }`}
                                                >
                                                    兑换
                                                </motion.button>
                                            </div>
                                        </motion.div>
                                    );
                                })
                            ) : (
                                // Inventory Items
                                inventory.length > 0 ? (
                                    inventory.map((invItem) => {
                                        const itemDef = SHOP_ITEMS.find(i => i.id === invItem.itemId);
                                        let Icon = Package;
                                        if (itemDef) {
                                             if (typeof itemDef.icon === 'string') {
                                                Icon = ICON_MAP[itemDef.icon] || Package;
                                            } else if (itemDef.icon) {
                                                Icon = itemDef.icon as any;
                                            }
                                        }

                                        return (
                                            <motion.div 
                                                layout
                                                key={invItem.objectId} 
                                                whileHover={{ y: -4 }}
                                                className="group relative bg-white/80 backdrop-blur-md border border-white/60 p-4 rounded-3xl shadow-sm hover:shadow-xl hover:border-blue-100 transition-all duration-300 flex flex-col items-center text-center overflow-hidden"
                                            >
                                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-200 to-indigo-200 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                
                                                <div className="w-16 h-16 mb-3 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300 border border-blue-50">
                                                    <Icon className="w-8 h-8 text-blue-500" strokeWidth={1.5} />
                                                </div>

                                                <h3 className="font-bold text-gray-800 text-sm mb-1 line-clamp-1">{invItem.itemName}</h3>
                                                <p className="text-[10px] text-blue-400/80 mb-4 font-medium uppercase tracking-wider">待使用</p>
                                                
                                                <motion.button
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => handleUse(invItem)}
                                                    disabled={loading}
                                                    className="w-full py-2 bg-gradient-to-r from-blue-400 to-indigo-500 text-white rounded-xl text-xs font-bold hover:shadow-lg hover:shadow-blue-500/20 mt-auto transition-all"
                                                >
                                                    立即使用
                                                </motion.button>
                                            </motion.div>
                                        );
                                    })
                                ) : (
                                    <div className="col-span-full text-center py-20 text-gray-400 flex flex-col items-center">
                                        <div className="p-6 bg-gray-50 rounded-full mb-4">
                                            <Package className="w-12 h-12 opacity-20" />
                                        </div>
                                        <p className="text-sm font-medium">背包空空如也</p>
                                        <p className="text-xs opacity-60 mt-1">快去商城看看吧</p>
                                    </div>
                                )
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                <ConfirmDialog
                    isOpen={dialogState.isOpen}
                    onClose={() => setDialogState(prev => ({ ...prev, isOpen: false }))}
                    onConfirm={dialogState.onConfirm}
                    title={dialogState.title}
                    message={dialogState.message}
                    type={dialogState.type}
                    confirmText={dialogState.confirmText}
                />
            </div>
        </div>
    );
}
