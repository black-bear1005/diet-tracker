import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash2, Heart, Info, Clock, CheckCircle } from 'lucide-react';
import { 
    BackendNotification, getMyNotifications, markNotificationAsRead, 
    markAllNotificationsAsRead, deleteNotification, confirmBind, finalizeBind,
    getOrCreateUserProfile 
} from '../services/bmob';
import { UserProfile } from '../types';
import { useToast } from './Toast';

interface NotificationCenterProps {
    onProfileUpdate?: (profile: UserProfile) => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ onProfileUpdate }) => {
    const { showToast } = useToast();
    const [notifications, setNotifications] = useState<BackendNotification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = async () => {
        try {
            const list = await getMyNotifications();
            setNotifications(list);
        } catch (error) {
            console.error('Fetch notifications failed:', error);
        }
    };

    // Auto-poll every 60s
    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, []);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const handleMarkAllRead = async () => {
        try {
            // Optimistic update
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            await markAllNotificationsAsRead();
        } catch (error) {
            console.error('Mark all read failed:', error);
        }
    };

    const handleNotificationClick = async (notification: BackendNotification) => {
        if (!notification.isRead && notification.type !== 'bind_request') {
            try {
                // Optimistic update
                setNotifications(prev => prev.map(n => 
                    n.objectId === notification.objectId ? { ...n, isRead: true } : n
                ));
                await markNotificationAsRead(notification.objectId!);
            } catch (error) {
                console.error('Mark read failed:', error);
            }
        }
    };

    const handleConfirmBind = async (notification: BackendNotification) => {
        if (!notification.relatedId || !notification.objectId) return;
        setProcessingId(notification.objectId);
        
        try {
            // Extract requester name from content if possible, or fallback to 'Partner'
            // Format: "${username} 想与你绑定情侣关系"
            const requesterName = notification.content.includes(' 想与你绑定情侣关系') 
                ? notification.content.replace(' 想与你绑定情侣关系', '') 
                : 'Partner';

            await confirmBind(notification.relatedId, notification.objectId, requesterName);
            // Refresh notifications (item should be deleted or marked read)
            await fetchNotifications();
            
            // Trigger profile update if callback provided
            if (onProfileUpdate) {
                try {
                    const profile = await getOrCreateUserProfile();
                    // We need to cast or map BackendUserProfile to Frontend UserProfile
                    // Assuming types are compatible enough for this context or use specific mapper
                    onProfileUpdate(profile as unknown as UserProfile);
                } catch (e) {
                    console.error('Profile refresh failed:', e);
                }
            }
            showToast('绑定成功！', 'success');
        } catch (error: any) {
            console.error('Bind confirm failed:', error);
            showToast(error.message || '绑定失败', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const handleRejectBind = async (notification: BackendNotification) => {
        if (!notification.objectId) return;
        // if (!window.confirm('确定要拒绝这个请求吗？')) return;
        
        try {
            setNotifications(prev => prev.filter(n => n.objectId !== notification.objectId));
            await deleteNotification(notification.objectId);
            showToast('已拒绝绑定请求', 'info');
        } catch (error) {
            console.error('Reject bind failed:', error);
        }
    };

    const handleFinalizeBind = async (notification: BackendNotification) => {
        if (!notification.relatedId || !notification.objectId) return;
        setProcessingId(notification.objectId);
        
        try {
            // Extract partner name from content if possible
            // Format: "${username} 已同意绑定，点击生效！"
            const partnerName = notification.content.includes(' 已同意绑定') 
                ? notification.content.replace(' 已同意绑定，点击生效！', '') 
                : 'Partner';

            await finalizeBind(notification.relatedId, partnerName, notification.objectId);
            await fetchNotifications();
            
             // Trigger profile update if callback provided
            if (onProfileUpdate) {
                try {
                    const profile = await getOrCreateUserProfile();
                    onProfileUpdate(profile as unknown as UserProfile);
                } catch (e) {
                    console.error('Profile refresh failed:', e);
                }
            }
            showToast('绑定最终完成！', 'success');
        } catch (error: any) {
            console.error('Finalize bind failed:', error);
            showToast(error.message || '操作失败', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        try {
            setNotifications(prev => prev.filter(n => n.objectId !== id));
            await deleteNotification(id);
        } catch (error) {
            console.error('Delete notification failed:', error);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'bind_request': return <Heart className="text-pink-500" size={20} />;
            case 'bind_accepted': return <Heart className="text-pink-500" fill="currentColor" size={20} />;
            case 'task_completed': return <CheckCircle className="text-green-500" size={20} />;
            case 'task_expired': return <Clock className="text-orange-500" size={20} />;
            default: return <Info className="text-blue-500" size={20} />;
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                    <div className="flex justify-between items-center px-4 py-3 border-b bg-gray-50">
                        <h3 className="font-semibold text-gray-700">消息通知</h3>
                        {unreadCount > 0 && (
                            <button 
                                onClick={handleMarkAllRead}
                                className="text-xs text-blue-600 hover:text-blue-700 flex items-center"
                            >
                                <Check size={12} className="mr-1" /> 全部已读
                            </button>
                        )}
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="py-8 text-center text-gray-400">
                                <Bell size={32} className="mx-auto mb-2 opacity-20" />
                                <p className="text-sm">暂无新消息</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {notifications.map(n => (
                                    <div 
                                        key={n.objectId}
                                        onClick={() => handleNotificationClick(n)}
                                        className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer relative group ${
                                            !n.isRead ? 'bg-blue-50/50' : ''
                                        }`}
                                    >
                                        <div className="flex gap-3">
                                            <div className="mt-0.5 flex-shrink-0">
                                                {getIcon(n.type)}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className={`text-sm font-medium ${!n.isRead ? 'text-gray-900' : 'text-gray-600'}`}>
                                                    {n.title}
                                                </h4>
                                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                                    {n.content}
                                                </p>
                                                
                                                {/* Bind Request Actions */}
                                                {n.type === 'bind_request' && (
                                                    <div className="mt-3 flex gap-2">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleConfirmBind(n); }}
                                                            disabled={processingId === n.objectId}
                                                            className="flex-1 px-3 py-1.5 bg-pink-500 text-white text-xs rounded-md hover:bg-pink-600 disabled:opacity-50 transition-colors"
                                                        >
                                                            {processingId === n.objectId ? '处理中...' : '同意绑定'}
                                                        </button>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleRejectBind(n); }}
                                                            disabled={processingId === n.objectId}
                                                            className="px-3 py-1.5 bg-gray-200 text-gray-600 text-xs rounded-md hover:bg-gray-300 disabled:opacity-50 transition-colors"
                                                        >
                                                            拒绝
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Bind Accepted Actions */}
                                                {n.type === 'bind_accepted' && (
                                                    <div className="mt-3">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleFinalizeBind(n); }}
                                                            disabled={processingId === n.objectId}
                                                            className="w-full px-3 py-1.5 bg-green-500 text-white text-xs rounded-md hover:bg-green-600 disabled:opacity-50 transition-colors"
                                                        >
                                                            {processingId === n.objectId ? '同步中...' : '点击同步绑定关系'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Delete Button (visible on hover) */}
                                            <button
                                                onClick={(e) => handleDelete(e, n.objectId!)}
                                                className="absolute top-2 right-2 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                                                title="删除"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationCenter;