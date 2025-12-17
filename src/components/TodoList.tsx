import React, { useState, useEffect, useRef } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks, isToday, addDays, subDays } from 'date-fns';
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
import { motion, AnimatePresence } from 'framer-motion';

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
  const scrollRef = useRef<HTMLDivElement>(null);
  
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

  const getDaysToDisplay = () => {
    // 显示前一周、当前周、后一周 (共3周)
    const start = subWeeks(currentWeekStart, 1);
    const end = endOfWeek(addWeeks(currentWeekStart, 1), { weekStartsOn: 0 });
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
    <div className="backdrop-blur-xl bg-white/80 border border-white/20 shadow-lg shadow-blue-500/5 rounded-2xl p-6 pt-safe-top">
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

      {/* 3-Week Scrollable Calendar Strip (Matches DailyLogger.tsx) */}
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

      {/* Input Area */}
      <div className="bg-white/50 border border-gray-100 rounded-xl p-4 mb-6 flex flex-col gap-3">
        {/* Row 1: Input */}
        <input
          type="text"
          value={newTodoContent}
          onChange={(e) => setNewTodoContent(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
          placeholder="添加一个新的待办事项..."
          className="w-full bg-white/80 border-none rounded-xl px-4 py-3 text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-sm"
        />

        {/* Row 2: Controls */}
        <div className="flex items-center justify-between mt-1">
          {/* Left: Assignee & Reward */}
          <div className="flex items-center gap-2 text-sm overflow-x-auto no-scrollbar">
              <div className="flex items-center bg-white/50 rounded-lg p-1 flex-shrink-0">
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
              
              <div className="flex items-center bg-white/50 rounded-lg px-3 py-1.5 border border-transparent focus-within:border-yellow-200 focus-within:bg-yellow-50 transition-colors flex-shrink-0">
                  <Coins size={14} className="text-yellow-500 mr-2" />
                  <span className="text-gray-500 mr-2 hidden sm:inline">悬赏</span>
                  <input 
                      type="number" 
                      min="0"
                      max={userProfile?.points || 0}
                      placeholder="0"
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
                      className="w-12 sm:w-16 bg-transparent outline-none font-medium text-gray-700"
                  />
              </div>
          </div>

          {/* Right: Add Button */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleAddTodo}
            disabled={!newTodoContent.trim()}
            className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:shadow-none transition-all flex-shrink-0 ml-2"
          >
            <Plus size={24} />
          </motion.button>
        </div>
      </div>

      {/* Todo List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-10 text-gray-400">加载中...</div>
        ) : todos.length === 0 ? (
          <div className="text-center py-10 text-gray-400 bg-white/50 rounded-xl border border-dashed border-gray-200">
            <CheckSquare size={48} className="mx-auto mb-3 opacity-20" />
            今天还没有待办事项，添加一个吧！
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {/* Active Todos */}
            {activeTodos.map(todo => {
                const isAssignedToMe = todo.assigneeId === currentUserId;
                const isCreatedByMe = todo.creatorId === currentUserId;
                const isPartnerTask = todo.creatorId !== todo.assigneeId;
                const isPendingApproval = todo.status === 'pending_approval';
                const isForced = todo.type === 'forced_task';
                
                return (
                    <motion.div 
                        key={todo.objectId}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`group flex items-center p-4 rounded-xl border shadow-sm hover:shadow-md transition-all ${
                            isForced ? 'bg-red-50/80 border-red-200 shadow-red-100' :
                            !isAssignedToMe ? 'border-pink-100 bg-pink-50/30' : 
                            isPendingApproval ? 'border-yellow-200 bg-yellow-50/50' : 'bg-white border-gray-100'
                        }`}
                    >
                        <motion.button
                        whileTap={{ scale: 0.8 }}
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
                        </motion.button>
                        
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
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
                    </motion.div>
                );
            })}

            {/* Completed Todos */}
            {completedTodos.length > 0 && (
              <div className="pt-4">
                <div className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">已完成</div>
                <div className="space-y-2">
                  {completedTodos.map(todo => (
                    <motion.div 
                      key={todo.objectId} 
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.6 }}
                      exit={{ opacity: 0, height: 0 }}
                      className="group flex items-center p-3 bg-gray-50/50 rounded-xl border border-transparent hover:border-gray-100 transition-all"
                    >
                      <motion.button
                        whileTap={{ scale: 0.8 }}
                        onClick={() => handleToggleTodo(todo)}
                        className="mr-4 text-green-500 hover:text-green-600 transition-colors"
                      >
                        <CheckSquare size={24} />
                      </motion.button>
                      <div className="flex-1">
                         <span className="text-gray-500 line-through decoration-gray-300 decoration-2">{todo.content}</span>
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
                    </motion.div>
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
                    <motion.div 
                      key={todo.objectId} 
                      layout
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
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </AnimatePresence>
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