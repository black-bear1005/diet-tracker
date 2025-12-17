import React, { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks, isToday } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, RotateCcw, Plus, Check, Trash2, 
  Square, CheckSquare, Users, User, Clock, Coins, AlertCircle, Gift, Heart, Flame, ShieldAlert
} from 'lucide-react';
import { 
  BackendTodo, getTodos, addTodo, toggleTodo, deleteTodo, 
  processExpiredTasks, createAssignedTodo, completeTodo, 
  submitTaskCompletion, approveTaskCompletion, rejectTaskCompletion,
  getCurrentUserId, getOrCreateUserProfile, BackendUserProfile 
} from '../services/bmob';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';

interface TodoListProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

const TodoList: React.FC<TodoListProps> = ({ selectedDate, onDateChange }) => {
  const { showToast } = useToast();
  const [todos, setTodos] = useState<BackendTodo[]>([]);
  const [newTodoContent, setNewTodoContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(selectedDate, { weekStartsOn: 0 }));
  
  // Couple features
  const [assignee, setAssignee] = useState<'self' | 'partner'>('self');
  const [rewardPoints, setRewardPoints] = useState<number | string>(0);
  const [userProfile, setUserProfile] = useState<BackendUserProfile | null>(null);
  const currentUserId = getCurrentUserId();

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

  // Date synchronization
  useEffect(() => {
    setCurrentWeekStart(startOfWeek(selectedDate, { weekStartsOn: 0 }));
  }, [selectedDate]);

  // Initial setup: Process expired tasks & load profile
  useEffect(() => {
    const init = async () => {
      try {
        await processExpiredTasks();
        const profile = await getOrCreateUserProfile();
        setUserProfile(profile);
      } catch (error) {
        console.error('Initialization failed:', error);
      }
    };
    init();
  }, []);

  // Fetch todos
  useEffect(() => {
    const fetchTodos = async () => {
      setLoading(true);
      try {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const list = await getTodos(dateStr);
        setTodos(list);
      } catch (error) {
        console.error('Failed to fetch todos:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTodos();
  }, [selectedDate]);

  const handleAddTodo = async () => {
    if (!newTodoContent.trim()) return;
    
    // Check points if assigning with reward
    const pointsValue = typeof rewardPoints === 'string' ? (parseInt(rewardPoints) || 0) : rewardPoints;
    if (pointsValue > 0 && userProfile) {
        if ((userProfile.points || 0) < pointsValue) {
            showToast(`积分不足！当前积分：${userProfile.points || 0}`, 'error');
            return;
        }
    }

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      let newTodo: BackendTodo;
      
      if (assignee === 'partner' && userProfile?.partnerId) {
          newTodo = await createAssignedTodo({
              date: dateStr,
              content: newTodoContent.trim(),
              assigneeId: userProfile.partnerId,
              rewardPoints: pointsValue
          });
          // Deduct points locally for immediate feedback
          if (pointsValue > 0) {
              setUserProfile(prev => prev ? ({ ...prev, points: (prev.points || 0) - pointsValue }) : null);
          }
      } else {
          // Self assignment (or fallback if no partner)
          const targetId = assignee === 'self' ? currentUserId || '' : (userProfile?.partnerId || currentUserId || '');
          newTodo = await createAssignedTodo({
              date: dateStr,
              content: newTodoContent.trim(),
              assigneeId: targetId,
              rewardPoints: pointsValue
          });
          if (pointsValue > 0) {
            setUserProfile(prev => prev ? ({ ...prev, points: (prev.points || 0) - pointsValue }) : null);
        }
      }

      setTodos([...todos, newTodo]);
      setNewTodoContent('');
      setRewardPoints(0);
      // Reset assignee to self to prevent accidental multiple assignments
      // setAssignee('self'); 
      showToast('任务添加成功', 'success');
    } catch (error: any) {
      console.error('Failed to add todo:', error);
      showToast(error.message || '添加任务失败', 'error');
    }
  };

  const handleToggleTodo = async (todo: BackendTodo) => {
    if (todo.status === 'expired') return;
    
    const isAssignee = todo.assigneeId === currentUserId;
    const isCreator = todo.creatorId === currentUserId;
    const isPartnerTask = todo.creatorId && todo.assigneeId && todo.creatorId !== todo.assigneeId;

    try {
      if (isPartnerTask) {
        // --- 伴侣任务流程 ---
        
        // 1. 待验收状态 (pending_approval)
        if (todo.status === 'pending_approval') {
            if (isCreator) {
                // 我是发布者 -> 确认验收
                // Optimistic update
                setTodos(prev => prev.map(t => t.objectId === todo.objectId ? { ...t, status: 'completed', isCompleted: true } as BackendTodo : t));
                await approveTaskCompletion(todo);
                showToast('任务已验收，积分已发放', 'success');
            } else {
                // 我是执行者 -> 等待验收中 (不可操作)
                showToast('等待对方验收中...', 'info');
                return;
            }
        } 
        // 2. 待完成状态 (pending)
        else if (todo.status === 'pending') {
            if (isAssignee) {
                // 我是执行者 -> 提交验收
                // Optimistic update
                setTodos(prev => prev.map(t => t.objectId === todo.objectId ? { ...t, status: 'pending_approval' } as BackendTodo : t));
                await submitTaskCompletion(todo);
                showToast('任务已提交，等待对方验收', 'success');
            } else {
                // 我是发布者 -> 不能帮对方完成
                showToast('这是给对方的任务，不能帮TA完成哦', 'error');
                return;
            }
        }
        // 3. 已完成状态 (completed)
        else if (todo.status === 'completed') {
            // 已完成的任务暂时不支持撤销 (涉及到积分回滚太复杂)
            return;
        }
      } else {
        // --- 普通任务流程 (自己给自己) ---
        
        // Optimistic update
        const isCompleting = todo.status !== 'completed';
        const updatedTodos = todos.map(t => 
            t.objectId === todo.objectId ? { 
                ...t, 
                status: isCompleting ? 'completed' : 'pending',
                isCompleted: isCompleting 
            } as BackendTodo : t
        );
        setTodos(updatedTodos);
        
        if (isCompleting) {
            await completeTodo(todo);
            // If points involved (self-reward?), refresh profile
            if (todo.rewardPoints && todo.rewardPoints > 0) {
                const profile = await getOrCreateUserProfile();
                setUserProfile(profile);
            }
        } else {
            // Revert to pending
            // Simple toggle for self-tasks
             await toggleTodo(todo);
        }
      }
    } catch (error: any) {
      console.error('Failed to toggle todo:', error);
      showToast(error.message || '操作失败', 'error');
      // Revert optimistic update
      const list = await getTodos(format(selectedDate, 'yyyy-MM-dd'));
      setTodos(list);
    }
  };

  const processRejectTask = async (todo: BackendTodo) => {
      try {
          // Optimistic
          setTodos(prev => prev.map(t => t.objectId === todo.objectId ? { ...t, status: 'pending' } as BackendTodo : t));
          await rejectTaskCompletion(todo);
          showToast('任务已驳回', 'info');
      } catch (e: any) {
          showToast(e.message || '操作失败', 'error');
      }
  };

  const handleRejectTask = (todo: BackendTodo) => {
      setDialogState({
          isOpen: true,
          title: '驳回任务',
          message: '确定要驳回这个任务吗？对方需要重新提交。',
          type: 'warning',
          confirmText: '确认驳回',
          onConfirm: () => processRejectTask(todo)
      });
  };

  const processDeleteTodo = async (id: string) => {
    try {
      const updatedTodos = todos.filter(t => t.objectId !== id);
      setTodos(updatedTodos);
      await deleteTodo(id);
    } catch (error) {
      console.error('Failed to delete todo:', error);
    }
  };

  const handleDeleteTodo = (todo: BackendTodo) => {
    // Check if it's a forced task and if current user is the creator (item user)
    // forced_task: creatorId is the one who used the item, assigneeId is the one who performs the task
    // Only creator can delete forced tasks
    if (todo.type === 'forced_task' && todo.creatorId !== currentUserId) {
        showToast('强制任务只能由发起人（使用道具的一方）删除！', 'error');
        return;
    }

    setDialogState({
        isOpen: true,
        title: '删除任务',
        message: '确定要删除这个任务吗？此操作不可恢复。',
        type: 'danger',
        confirmText: '确认删除',
        onConfirm: () => todo.objectId && processDeleteTodo(todo.objectId)
    });
  };

  const getDaysInWeek = () => {
    const start = currentWeekStart;
    const end = endOfWeek(currentWeekStart, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  };

  const activeTodos = todos
    .filter(t => t.status !== 'completed' && t.status !== 'expired')
    .sort((a, b) => {
        // Forced tasks first
        if (a.type === 'forced_task' && b.type !== 'forced_task') return -1;
        if (a.type !== 'forced_task' && b.type === 'forced_task') return 1;
        return 0;
    });
  const completedTodos = todos.filter(t => t.status === 'completed');
  const expiredTodos = todos.filter(t => t.status === 'expired');

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center justify-between">
        <div className="flex items-center">
            <CheckSquare className="mr-2 text-blue-600" size={24} />
            今日待办
        </div>
        {userProfile && (
            <div className="text-sm font-medium text-yellow-600 flex items-center bg-yellow-50 px-3 py-1 rounded-full">
                <Coins size={16} className="mr-1" />
                {userProfile.points || 0}
            </div>
        )}
      </h2>

      {/* Weekly Calendar Strip */}
      <div className="mb-8 bg-white rounded-xl shadow-sm p-4 border border-gray-100 overflow-hidden">
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
            <span className="hidden sm:inline">回到今天</span>
            <span className="sm:hidden">今天</span>
          </button>
        </div>
        
        <div className="flex justify-between overflow-x-auto no-scrollbar gap-1 sm:grid sm:grid-cols-7 sm:gap-2">
          {getDaysInWeek().map(day => {
            const isSelected = isSameDay(day, selectedDate);
            const isTodayDate = isToday(day);
            
            return (
              <button
                key={day.toISOString()}
                onClick={() => onDateChange(day)}
                className={`flex flex-col items-center justify-center py-2 sm:py-3 px-2 min-w-[3rem] sm:min-w-0 rounded-2xl transition-all duration-200 flex-1 ${
                  isSelected
                    ? 'bg-blue-500 text-white shadow-md transform scale-105'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <span className={`text-[10px] sm:text-xs mb-1 font-medium ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                  {format(day, 'EEE', { locale: zhCN })}
                </span>
                <span className={`text-base sm:text-lg font-bold ${isSelected ? 'text-white' : 'text-gray-700'}`}>
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

      {/* Input Area */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 space-y-3">
        <div className="flex gap-3 items-center">
            <input
            type="text"
            value={newTodoContent}
            onChange={(e) => setNewTodoContent(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
            placeholder="添加一个新的待办事项..."
            className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
            <button
            onClick={handleAddTodo}
            disabled={!newTodoContent.trim()}
            className="p-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 shadow-lg shadow-blue-200 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
            >
            <Plus size={24} />
            </button>
        </div>
        
        {/* Advanced Options */}
        <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center bg-gray-50 rounded-lg p-1">
                <button
                    onClick={() => setAssignee('self')}
                    className={`px-3 py-1.5 rounded-md flex items-center transition-all ${assignee === 'self' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <User size={14} className="mr-1.5" />
                    自己
                </button>
                <button
                    onClick={() => setAssignee('partner')}
                    disabled={!userProfile?.partnerId}
                    className={`px-3 py-1.5 rounded-md flex items-center transition-all ${assignee === 'partner' ? 'bg-white shadow-sm text-pink-600' : 'text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                    title={!userProfile?.partnerId ? "请先在个人档案绑定伴侣" : ""}
                >
                    <Heart size={14} className="mr-1.5" />
                    伴侣
                </button>
            </div>
            
            <div className="flex items-center bg-gray-50 rounded-lg px-3 py-1.5 border border-transparent focus-within:border-yellow-200 focus-within:bg-yellow-50 transition-colors">
                <Coins size={14} className="text-yellow-500 mr-2" />
                <span className="text-gray-500 mr-2">悬赏</span>
                <input 
                    type="number" 
                    min="0"
                    max={userProfile?.points || 0}
                    value={rewardPoints}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                            setRewardPoints('');
                        } else {
                            const num = parseInt(val);
                            if (!isNaN(num) && num >= 0) {
                                setRewardPoints(num);
                            }
                        }
                    }}
                    className="w-16 bg-transparent outline-none font-medium text-gray-700"
                />
            </div>
        </div>
      </div>

      {/* Todo List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-10 text-gray-400">加载中...</div>
        ) : todos.length === 0 ? (
          <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <CheckSquare size={48} className="mx-auto mb-3 opacity-20" />
            今天还没有待办事项，添加一个吧！
          </div>
        ) : (
          <>
            {/* Active Todos */}
            {activeTodos.map(todo => {
                const isAssignedToMe = todo.assigneeId === currentUserId;
                const isCreatedByMe = todo.creatorId === currentUserId;
                const isPartnerTask = todo.creatorId !== todo.assigneeId;
                const isPendingApproval = todo.status === 'pending_approval';
                const isForced = todo.type === 'forced_task';
                
                return (
                    <div 
                        key={todo.objectId} 
                        className={`group flex items-center p-4 rounded-xl border shadow-sm hover:shadow-md transition-all ${
                            isForced ? 'bg-red-50 border-red-200 shadow-red-100' :
                            !isAssignedToMe ? 'border-pink-100 bg-pink-50/30' : 
                            isPendingApproval ? 'border-yellow-200 bg-yellow-50/50' : 'bg-white border-gray-100'
                        }`}
                    >
                        <button
                        onClick={() => handleToggleTodo(todo)}
                        className={`mr-4 transition-colors ${
                            isForced ? 'text-red-500 hover:text-red-600' :
                            isPendingApproval 
                                ? 'text-yellow-500 hover:text-yellow-600' 
                                : 'text-gray-300 hover:text-blue-500'
                        }`}
                        title={
                            isPendingApproval 
                                ? (isCreatedByMe ? "点击验收任务" : "等待对方验收") 
                                : (isAssignedToMe ? "点击完成" : "等待对方完成")
                        }
                        >
                        {isPendingApproval ? <Clock size={24} /> : (isForced ? <Flame size={24} /> : <Square size={24} />)}
                        </button>
                        
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`font-medium text-lg ${isPendingApproval ? 'text-gray-600' : (isForced ? 'text-red-700 font-bold' : 'text-gray-800')}`}>
                                    {todo.content}
                                </span>
                                {isForced && (
                                    <span className="text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded-full flex items-center">
                                        <ShieldAlert size={10} className="mr-1" />
                                        强制执行
                                    </span>
                                )}
                                {todo.rewardPoints && todo.rewardPoints > 0 && (
                                    <span className="flex items-center text-xs font-bold text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full">
                                        <Coins size={10} className="mr-1" />
                                        {todo.rewardPoints}
                                    </span>
                                )}
                                {isPendingApproval && (
                                    <span className="text-xs font-bold text-yellow-600 border border-yellow-200 bg-yellow-50 px-2 py-0.5 rounded-full">
                                        {isCreatedByMe ? "待你验收" : "待验收"}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-400">
                                {isPartnerTask && (
                                    <span className="flex items-center">
                                        {isCreatedByMe ? (
                                            <><User size={10} className="mr-1"/> 指派给伴侣</>
                                        ) : (
                                            <><Heart size={10} className="mr-1"/> 来自伴侣的甜蜜任务</>
                                        )}
                                    </span>
                                )}
                                {isForced && !isPendingApproval && (
                                    <span className="text-red-400 flex items-center">
                                        ⚠️ 必须完成，否则将受到随机惩罚！
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            {isPendingApproval && isCreatedByMe && (
                                <button
                                    onClick={() => handleRejectTask(todo)}
                                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg"
                                    title="驳回任务"
                                >
                                    <RotateCcw size={20} />
                                </button>
                            )}
                            
                            <button
                                onClick={() => handleDeleteTodo(todo)}
                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg"
                                title="删除任务"
                            >
                                <Trash2 size={20} />
                            </button>
                        </div>
                    </div>
                );
            })}

            {/* Completed Todos */}
            {completedTodos.length > 0 && (
              <div className="pt-4">
                <div className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">已完成</div>
                <div className="space-y-2">
                  {completedTodos.map(todo => (
                    <div 
                      key={todo.objectId} 
                      className="group flex items-center p-3 bg-gray-50 rounded-xl border border-transparent hover:border-gray-100 transition-all opacity-60 hover:opacity-100"
                    >
                      <button
                        onClick={() => handleToggleTodo(todo)}
                        className="mr-4 text-green-500 hover:text-green-600 transition-colors"
                      >
                        <CheckSquare size={24} />
                      </button>
                      <div className="flex-1">
                         <span className="text-gray-500 line-through">{todo.content}</span>
                         {todo.rewardPoints && todo.rewardPoints > 0 && (
                            <span className="ml-2 inline-flex items-center text-xs text-gray-400">
                                <Coins size={10} className="mr-0.5" />
                                +{todo.rewardPoints}
                            </span>
                         )}
                      </div>
                      <button
                        onClick={() => handleDeleteTodo(todo)}
                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Expired Todos */}
            {expiredTodos.length > 0 && (
              <div className="pt-4">
                <div className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider flex items-center">
                    <AlertCircle size={12} className="mr-1" />
                    已过期
                </div>
                <div className="space-y-2">
                  {expiredTodos.map(todo => (
                    <div 
                      key={todo.objectId} 
                      className={`group flex items-center p-3 rounded-xl border border-transparent transition-all ${
                          todo.isPunished ? 'bg-red-50 opacity-90' : 'bg-gray-100 opacity-50'
                      }`}
                    >
                      <div className={`mr-4 ${todo.isPunished ? 'text-red-300' : 'text-gray-300'}`}>
                        {todo.isPunished ? <ShieldAlert size={24} /> : <Square size={24} />}
                      </div>
                      <div className="flex-1">
                         <span className={`${todo.isPunished ? 'text-red-800 line-through' : 'text-gray-500 line-through'}`}>{todo.content}</span>
                         {todo.rewardPoints && todo.rewardPoints > 0 && !todo.isPunished && (
                            <span className="ml-2 inline-flex items-center text-xs text-gray-400">
                                <Coins size={10} className="mr-0.5" />
                                退还 {todo.rewardPoints}
                            </span>
                         )}
                         {todo.isPunished && (
                             <div className="text-xs font-bold text-red-600 mt-1">
                                 ⚠️ 惩罚生效：{todo.punishmentContent}
                             </div>
                         )}
                      </div>
                      <button
                        onClick={() => handleDeleteTodo(todo)}
                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

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
};

export default TodoList;