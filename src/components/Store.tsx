import React, { useState, useEffect } from 'react';
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
        <div className="p-4 pb-24 space-y-6 animate-in fade-in duration-500">
            {/* Header with Points */}
            <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-orange-100">
                <div className="flex items-center gap-2 text-orange-600 font-bold text-lg">
                    <ShoppingBag className="w-6 h-6" />
                    <span>积分商城</span>
                </div>
                <div className="flex items-center gap-2 bg-orange-50 px-3 py-1.5 rounded-full text-orange-700 font-medium">
                    <Coins className="w-4 h-4" />
                    <span>{points} 分</span>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-gray-100 rounded-lg">
                <button
                    onClick={() => setActiveTab('buy')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                        activeTab === 'buy' ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <ShoppingBag className="w-4 h-4" />
                    购买道具
                </button>
                <button
                    onClick={() => setActiveTab('bag')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                        activeTab === 'bag' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <Package className="w-4 h-4" />
                    我的背包
                </button>
            </div>

            {/* Content */}
            {loading && inventory.length === 0 && activeTab === 'bag' ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {activeTab === 'buy' ? (
                        // Shop Items
                        SHOP_ITEMS.map((item) => {
                            // Support both string icon name and direct component
                            let Icon = Package;
                            if (typeof item.icon === 'string') {
                                Icon = ICON_MAP[item.icon] || Package;
                            } else if (item.icon) {
                                Icon = item.icon as any;
                            }
                            
                            const canAfford = points >= item.price;

                            return (
                                <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center min-h-[160px] hover:shadow-md transition-all">
                                    <div className="p-3 bg-orange-50 rounded-full text-orange-500 mb-3">
                                        <Icon className="w-8 h-8" />
                                    </div>
                                    <h3 className="font-bold text-gray-800 mb-1">{item.name}</h3>
                                    <p className="text-xs text-gray-500 mb-3 line-clamp-2 flex-grow">{item.desc}</p>
                                    
                                    <div className="w-full mt-auto">
                                        <div className="text-orange-600 font-bold mb-2">{item.price} 积分</div>
                                        <button
                                            onClick={() => handleBuy(item)}
                                            disabled={!canAfford || loading}
                                            className={`w-full py-2 rounded-lg text-xs font-bold transition-colors ${
                                                canAfford 
                                                    ? 'bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700' 
                                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                            }`}
                                        >
                                            购买
                                        </button>
                                    </div>
                                </div>
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
                                    <div key={invItem.objectId} className="bg-white p-4 rounded-xl shadow-sm border border-blue-50 flex flex-col items-center text-center min-h-[160px] hover:shadow-md transition-all">
                                        <div className="p-3 bg-blue-50 rounded-full text-blue-500 mb-3">
                                            <Icon className="w-8 h-8" />
                                        </div>
                                        <h3 className="font-bold text-gray-800 mb-1">{invItem.itemName}</h3>
                                        <p className="text-xs text-gray-400 mb-3 flex-grow">未使用</p>
                                        
                                        <button
                                            onClick={() => handleUse(invItem)}
                                            disabled={loading}
                                            className="w-full py-2 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600 transition-colors mt-auto"
                                        >
                                            立即使用
                                        </button>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="col-span-full text-center py-12 text-gray-400">
                                <Package className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                <p>背包空空如也，快去商城逛逛吧~</p>
                            </div>
                        )
                    )}
                </div>
            )}

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
    );
}
