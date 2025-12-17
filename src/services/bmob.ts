// 🔴 Bmob 密钥 (已确认无误)
const APP_ID = "75f9def7af7038fab8272695bd821027";
const API_KEY = "153c3d8f39a138fd49e6af03586e1501";
const MASTER_KEY = ""; 

// 自动切换 API 地址：
// 开发环境 (npm run dev): 使用 /bmob 触发本地代理 (vite.config.ts)
// 生产环境 (GitHub Pages): 直接连接 Bmob 云端 API
const BMOB_HOST = import.meta.env.DEV ? '/bmob' : 'https://api.bmobcloud.com';
const BMOB_BASE = `${BMOB_HOST}/1`;

const LS_KEYS = {
  sessionToken: 'bmob_session_token',
  currentUserId: 'bmob_current_user_id',
  currentUserCompatId: 'bmob_user_id',
  currentUser: 'bmob_current_user'
};

export const isBmobReady = (): boolean => !!APP_ID && !!API_KEY;
export const initBmob = (): void => { if (!isBmobReady()) console.warn('Bmob Key Missing'); };

export interface BackendUserProfile {
  objectId?: string;
  userId: string;
  username?: string; // 冗余存储用户名，用于搜索
  nickname?: string; // 展示用的昵称
  avatarUrl?: string; // 头像图片链接
  user?: { __type: 'Pointer'; className: '_User'; objectId: string };
  gender: 'male' | 'female' | string;
  height: number;
  birthday: string;
  targetDeficit: number;
  activityLevel: number;
  weight?: number;
  partnerId?: string;
  partnerName?: string;
  points?: number;
}

export interface BackendDailyLog {
  objectId?: string;
  userId: string;
  user?: { __type: 'Pointer'; className: '_User'; objectId: string };
  date: string;
  weight?: number | null;
  foodIntake: Array<{ name: string; kcal: number }>;
  exercise: Array<{ type?: string; name?: string; mins?: number; kcal: number }>;
}

export interface BackendNotification {
    objectId?: string;
    userId: string; // 接收通知的人
    type: 'bind_request' | 'bind_accepted' | 'task_completed' | 'task_submitted' | 'task_rejected' | 'task_expired' | 'system';
    title: string;
    content: string;
    isRead: boolean;
    relatedId?: string; // 关联ID
    extraData?: any;
    createdAt?: string;
}

const getSessionToken = () => { try { return localStorage.getItem(LS_KEYS.sessionToken); } catch { return null; } };
export const getCurrentUserId = () => {
  try { return localStorage.getItem(LS_KEYS.currentUserId) || localStorage.getItem(LS_KEYS.currentUserCompatId); } catch { return null; }
};

export const logout = () => {
  console.log('[Auth] 登出清理...');
  try {
    localStorage.removeItem(LS_KEYS.sessionToken);
    localStorage.removeItem(LS_KEYS.currentUserId);
    localStorage.removeItem(LS_KEYS.currentUserCompatId);
    localStorage.removeItem(LS_KEYS.currentUser);
  } catch {}
};

const setSession = (user: any) => {
  console.log('[Auth] 设置新身份 ID:', user.objectId);
  try {
    logout(); 
    if (user?.sessionToken) localStorage.setItem(LS_KEYS.sessionToken, user.sessionToken);
    if (user?.objectId) {
      localStorage.setItem(LS_KEYS.currentUserId, user.objectId);
      localStorage.setItem(LS_KEYS.currentUserCompatId, user.objectId);
    }
    localStorage.setItem(LS_KEYS.currentUser, JSON.stringify(user || {}));
  } catch (e) {
    console.error('[Auth] Session error:', e);
  }
};

export const getCurrentUser = () => {
  try { const d = localStorage.getItem(LS_KEYS.currentUser); return d ? JSON.parse(d) : null; } catch { return null; }
};

const rest = async (path: string, init: RequestInit = {}) => {
  if (!isBmobReady()) throw new Error('Bmob Config Missing');
  const token = getSessionToken();
  
  // 1. 干净的请求头，不加可能导致 500 的自定义头
  const headers = {
    'X-Bmob-Application-Id': APP_ID,
    'X-Bmob-REST-API-Key': API_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(token ? { 'X-Bmob-Session-Token': token } : {})
  } as any;

  // 2. 只有 GET 请求才加时间戳防缓存，POST/PUT 保持原样以免服务器报错
  let url = `${BMOB_BASE}${path}`;
  if (!init.method || init.method.toUpperCase() === 'GET') {
    const separator = path.includes('?') ? '&' : '?';
    url = `${url}${separator}_t=${Date.now()}`;
  }

  // console.log(`[API] ${init.method || 'GET'} ${url}`);

  const res = await fetch(url, { 
    ...init, 
    headers, 
    cache: 'no-store' // 3. 使用标准 Fetch API 禁用缓存
  });

  if (!res.ok) {
    const text = await res.text();
    try {
      const errObj = JSON.parse(text);
      if (errObj.code === 101) throw new Error(`BMOB_CLASS_NOT_FOUND: ${path}`);
      if (res.status === 401) logout();
      throw new Error(`Bmob Error ${res.status} [${path}]: ${errObj.error || text}`);
    } catch (e: any) {
      if (e.message.includes('BMOB_CLASS_NOT_FOUND')) throw e;
      throw new Error(`Bmob Error ${res.status} [${path}]: ${text}`);
    }
  }
  return res.json();
};

const safeQuery = async (path: string) => {
  try { return await rest(path, { method: 'GET' }); } 
  catch (err: any) {
    if (err.message.includes('BMOB_CLASS_NOT_FOUND')) return { results: [] };
    throw err;
  }
};

export const uploadFile = async (file: File): Promise<string> => {
  if (!isBmobReady()) throw new Error('Bmob Config Missing');
  
  // 1. 文件名编码，防止中文乱码
  const filename = encodeURIComponent(file.name);
  
  // 2. 直接调用 Bmob 文件上传接口
  // POST /2/files/:filename
  const url = `${BMOB_HOST}/2/files/${filename}`;
  
  const headers = {
    'X-Bmob-Application-Id': APP_ID,
    'X-Bmob-REST-API-Key': API_KEY,
    'Content-Type': file.type,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: file
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`File Upload Error ${res.status}: ${text}`);
  }

  const data = await res.json();
  // Bmob 返回格式: { "filename": "...", "url": "http://..." }
  return data.url;
};

// ==================== 业务逻辑 (保持 userId 绑定) ====================

export const getOrCreateUserProfile = async (): Promise<BackendUserProfile> => {
  const uid = getCurrentUserId();
  const currentUser = getCurrentUser();
  console.log('🔍 [Profile] 查询身份:', uid);
  if (!uid) throw new Error('User not logged in');

  // 使用 userId 字符串进行更简单的查询，同时尝试匹配 user 指针
  const queryObj = {
    userId: uid
  };
  const query = encodeURIComponent(JSON.stringify(queryObj));
  
  // 查询时可能返回空或不匹配的数据，需要客户端二次校验
  const list = await safeQuery(`/classes/UserProfile_v2?where=${query}&limit=10`);
  
  let profile: BackendUserProfile | undefined;
  if (Array.isArray(list.results)) {
    // 客户端严格过滤，确保只获取属于当前用户的数据
    profile = list.results.find((p: any) => p.userId === uid);
  }

  if (profile) {
    console.log('✅ [Profile] 找到匹配档案:', profile.objectId);
    
    // 兼容性处理：如果 nickname 为空，默认使用 username
    if (!profile.nickname) {
        profile.nickname = profile.username || '用户';
    }

    // 检查是否需要补全 username 或修复 ACL (老数据可能没有 username 或 ACL 为私有)
    // 强制每次检查并更新，确保该用户的 Profile 是公有读的，这样才能被搜到
    if (currentUser?.username) {
        const needsUpdate = !profile.username || profile.username !== currentUser.username;
        // 即使 username 没变，我们也希望能刷新 ACL，但为了避免每次都请求，我们可以加一个 localStorage 标记
        // 或者简单粗暴一点：只要 username 不存在就刷。
        // 但问题是：之前只刷了 username 没刷 ACL 的用户怎么办？
        // 方案：我们引入一个特殊字段或者只是简单的总是尝试更新 ACL（只要不是刚更新过）
        
        // 这里我们选择：只要当前 session 没更新过，就更新一次。
        const aclUpdateKey = `bmob_acl_fixed_${profile.objectId}`;
        const hasFixedAcl = sessionStorage.getItem(aclUpdateKey);

        if (needsUpdate || !hasFixedAcl) {
            console.log('🔧 [Profile] 同步 username 并修复 ACL 为公有读');
            
            // 构造 ACL: 公有读，自己写，如果有伴侣，伴侣也可以写 (用于积分奖励)
            const newACL: any = { "*": { "read": true }, [uid]: { "write": true } };
            if (profile.partnerId) {
                newACL[profile.partnerId] = { "write": true };
            }

            try {
                await rest(`/classes/UserProfile_v2/${profile.objectId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ 
                        username: currentUser.username,
                        ACL: newACL
                    })
                });
                profile.username = currentUser.username;
                sessionStorage.setItem(aclUpdateKey, 'true');
            } catch (e) {
                console.warn('同步 Profile/ACL 失败', e);
            }
        }
    }
    return profile;
  }
  
  console.log('✨ [Profile] 未找到匹配档案，创建新档案 for:', uid);
  
  // 初始创建时的 ACL: 公有读，自己写。伴侣 ID 此时还不存在，等绑定后再更新。
  const saved = await rest('/classes/UserProfile_v2', {
    method: 'POST',
    body: JSON.stringify({
      userId: uid,
      username: currentUser?.username || 'Unknown', // 写入用户名
      user: { __type: 'Pointer', className: '_User', objectId: uid },
      gender: 'male',
      height: 170,
      birthday: '1990-01-01',
      targetDeficit: 500,
      activityLevel: 1.375,
      weight: 70, // 默认体重
      points: 100, // 默认积分
      isProfileCompleted: false, // 标记为未完成，防止自动跳转
      // ACL: 公有读，私有写 (允许其他人查询到该用户的档案以进行绑定)
      ACL: { "*": { "read": true }, [uid]: { "write": true } }
    })
  });
  return await rest(`/classes/UserProfile_v2/${saved.objectId}`, { method: 'GET' });
};

export const updateUserProfileFields = async (
  profile: BackendUserProfile,
  fields: Partial<BackendUserProfile>
) => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not logged in');
  
  // 再次校验所有权
  if (profile.userId !== uid) {
      throw new Error('FORBIDDEN: Local profile ownership mismatch');
  }

  const existing = await rest(`/classes/UserProfile_v2/${profile.objectId}`, { method: 'GET' });
  const ownerMatch = existing.userId === uid;
  if (!ownerMatch) {
    const err: any = new Error('FORBIDDEN: profile not owned by current user');
    err.status = 403;
    throw err;
  }
  return await rest(`/classes/UserProfile_v2/${profile.objectId}`, {
    method: 'PUT',
    body: JSON.stringify(fields)
  });
};

export const getOrCreateDailyLog = async (date: string): Promise<BackendDailyLog> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not logged in');

  const queryObj = {
    date,
    userId: uid
  };
  const query = encodeURIComponent(JSON.stringify(queryObj));
  const list = await safeQuery(`/classes/DailyLog_v2?where=${query}&limit=10`);
  
  let log: BackendDailyLog | undefined;
  if (Array.isArray(list.results)) {
    log = list.results.find((p: any) => 
      p.date === date && p.userId === uid
    );
  }
  
  if (log) return log;
  
  const saved = await rest('/classes/DailyLog_v2', {
    method: 'POST',
    body: JSON.stringify({
      userId: uid,
      user: { __type: 'Pointer', className: '_User', objectId: uid },
      date,
      weight: null,
      foodIntake: [],
      exercise: [],
      ACL: { [uid]: { read: true, write: true } }
    })
  });
  return await rest(`/classes/DailyLog_v2/${saved.objectId}`, { method: 'GET' });
};

export const updateDailyLogFields = async (
  daily: BackendDailyLog,
  fields: Partial<BackendDailyLog>
) => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not logged in');
  
  // 客户端校验
  if (daily.userId !== uid) {
      throw new Error('FORBIDDEN: Local log ownership mismatch');
  }

  const existing = await rest(`/classes/DailyLog_v2/${daily.objectId}`, { method: 'GET' });
  const ownerMatch = existing.userId === uid;
  if (!ownerMatch) {
    const err: any = new Error('FORBIDDEN: daily log not owned by current user');
    err.status = 403;
    throw err;
  }
  return await rest(`/classes/DailyLog_v2/${daily.objectId}`, {
    method: 'PUT',
    body: JSON.stringify(fields)
  });
};

export const fetchAllDailyLogs = async (limit = 120): Promise<BackendDailyLog[]> => {
  const uid = getCurrentUserId();
  if (!uid) return [];
  
  const query = encodeURIComponent(JSON.stringify({
    userId: uid
  }));
  const list = await safeQuery(`/classes/DailyLog_v2?where=${query}&order=date&limit=${limit}`);
  
  if (!Array.isArray(list.results)) return [];
  
  // 严格过滤
  return list.results.filter((p: any) => p.userId === uid);
};

// Auth
export const login = async (username: string, password: string) => {
  logout();
  const params = new URLSearchParams({ username, password });
  const user = await rest(`/login?${params.toString()}`, { method: 'GET' });
  setSession(user);
  return user;
};

// ==================== 食物库逻辑 ====================

export interface FoodLibraryItem {
  objectId?: string;
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  unit: string;
}

// 内存缓存，避免频繁请求后端导致的搜索失败
let foodLibraryCache: FoodLibraryItem[] | null = null;

export const searchFoodLibrary = async (keyword: string): Promise<FoodLibraryItem[]> => {
  // 1. 如果缓存为空，一次性拉取所有数据（目前数据量 < 500，前端过滤体验极佳且绝对稳定）
  if (!foodLibraryCache) {
    try {
      console.log('📦 [FoodLibrary] 正在拉取全量数据建立缓存...');
      // 加上时间戳防止 HTTP 缓存
      const list = await safeQuery(`/classes/FoodLibrary?limit=500&_t=${Date.now()}`);
      if (Array.isArray(list.results)) {
        foodLibraryCache = list.results;
        console.log(`✅ [FoodLibrary] 缓存建立成功，共 ${foodLibraryCache.length} 条数据`);
      } else {
        foodLibraryCache = [];
      }
    } catch (e) {
      console.error('❌ [FoodLibrary] 拉取数据失败', e);
      return [];
    }
  }

  if (!keyword) return [];

  // 2. 前端纯内存过滤，速度快且无视后端正则兼容性问题
  const lowerKeyword = keyword.toLowerCase().trim();
  return (foodLibraryCache || []).filter(item => 
    item.name && item.name.toLowerCase().includes(lowerKeyword)
  );
};

export const seedFoodLibrary = async (data: any[]): Promise<void> => {
  if (!isBmobReady()) return;
  
  // 1. 获取现有数据的名称列表，用于去重
  // 我们获取前 500 条数据的 name 字段，这对于目前的 ~100 条数据足够了
  const existing = await safeQuery('/classes/FoodLibrary?limit=500&keys=name');
  const existingNames = new Set(Array.isArray(existing.results) ? existing.results.map((r: any) => r.name) : []);

  if (existingNames.size >= data.length) {
    console.log('🍎 [FoodLibrary] 数据完整，跳过初始化');
    return;
  }

  console.log(`🚀 [FoodLibrary] 检测到数据缺失 (现有 ${existingNames.size}/${data.length})，开始补充...`);
  
  // 2. 过滤出未入库的数据
  const toInsert = data.filter(d => !existingNames.has(d.name));
  
  if (toInsert.length === 0) return;

  // 3. 构造批量请求
  const requests = toInsert.map(item => ({
    method: 'POST',
    path: '/1/classes/FoodLibrary', // 注意：Batch 请求中 path 需要包含版本号 /1
    body: {
      ...item,
      ACL: { "*": { "read": true }, "role:admin": { "write": true } } // 公开读，管理员写
    }
  }));

  // 4. Bmob 批量操作接口 /batch (分批处理，每次50个)
  const batchUrl = `${BMOB_BASE}/batch`;
  for (let i = 0; i < requests.length; i += 50) {
    const chunk = requests.slice(i, i + 50);
    try {
        const res = await rest('/batch', {
            method: 'POST',
            body: JSON.stringify({ requests: chunk })
        });
        
        // 检查返回结果中是否有错误
        const errors = Array.isArray(res) ? res.filter((r: any) => r.error) : [];
        if (errors.length > 0) {
            console.error(`⚠️ [FoodLibrary] 批次 ${i/50 + 1} 部分写入失败:`, errors[0].error);
        } else {
            console.log(`✅ [FoodLibrary] 批次 ${i/50 + 1} 写入完成 (包含 ${chunk.length} 条)`);
        }
    } catch (e) {
        console.error(`❌ [FoodLibrary] 批次 ${i/50 + 1} 写入失败`, e);
    }
  }
  console.log('✨ [FoodLibrary] 增量更新完成');
};

export interface BackendTodo {
  objectId?: string;
  userId: string;
  date: string; // YYYY-MM-DD
  content: string;
  isCompleted?: boolean; // Deprecated
  status?: 'pending' | 'completed' | 'expired' | 'pending_approval';
  assigneeId?: string;
  creatorId?: string;
  rewardPoints?: number;
  type?: 'normal' | 'forced_task';
  isPunished?: boolean;
  punishmentContent?: string;
}

export const getTodos = async (date: string): Promise<BackendTodo[]> => {
  const uid = getCurrentUserId();
  if (!uid) return [];

  // 查询：我是创建者 OR 我是执行者
  // Bmob OR 查询语法: where={"$or":[{"userId":"me"},{"assigneeId":"me"}]}
  const queryObj = {
    date,
    "$or": [
        { "userId": uid },
        { "assigneeId": uid }
    ]
  };
  const query = encodeURIComponent(JSON.stringify(queryObj));
  // 按创建时间升序排列，即新添加的在后面
  const list = await safeQuery(`/classes/Todo?where=${query}&order=createdAt&limit=100`);
  
  if (!Array.isArray(list.results)) return [];
  
  return list.results.map((todo: any) => ({
      ...todo,
      // 兼容旧数据
      status: todo.status || (todo.isCompleted ? 'completed' : 'pending'),
      creatorId: todo.creatorId || todo.userId
  }));
};

export const addTodo = async (date: string, content: string): Promise<BackendTodo> => {
  // Simple add (self-assigned)
  return createAssignedTodo({
      date,
      content,
      rewardPoints: 0,
      assigneeId: getCurrentUserId()
  });
};

export const createAssignedTodo = async (todoData: {
    date: string; 
    content: string; 
    rewardPoints: number; 
    assigneeId?: string; 
}): Promise<BackendTodo> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not logged in');

  const assigneeId = todoData.assigneeId || uid;
  const reward = todoData.rewardPoints || 0;

  // 1. 扣除积分 (如果悬赏 > 0)
  if (reward > 0) {
      const profile = await getOrCreateUserProfile();
      if ((profile.points || 0) < reward) {
          throw new Error('积分不足');
      }
      await updateUserProfileFields(profile, { points: (profile.points || 0) - reward });
  }

  // 2. 创建 Todo
  // ACL: 创建者和执行者都有权读写
  const acl: any = { [uid]: { read: true, write: true } };
  if (assigneeId !== uid) {
      acl[assigneeId] = { read: true, write: true };
  }

  const saved = await rest('/classes/Todo', {
    method: 'POST',
    body: JSON.stringify({
      userId: uid, // Owner/Creator
      creatorId: uid,
      assigneeId,
      date: todoData.date,
      content: todoData.content,
      rewardPoints: reward,
      status: 'pending',
      isCompleted: false, // Compat
      ACL: acl
    })
  });
  
  return {
    objectId: saved.objectId,
    userId: uid,
    creatorId: uid,
    assigneeId,
    date: todoData.date,
    content: todoData.content,
    rewardPoints: reward,
    status: 'pending',
    isCompleted: false
  };
};

export const toggleTodo = async (todo: BackendTodo): Promise<void> => {
    // Deprecated, redirect to completeTodo
    if (todo.status !== 'completed') {
        await completeTodo(todo);
    }
};

export const submitTaskCompletion = async (todo: BackendTodo): Promise<void> => {
    if (!todo.objectId) return;
    const uid = getCurrentUserId();
    if (!uid) throw new Error('Not logged in');

    // 只有 assignee 可以提交任务
    if (todo.assigneeId && todo.assigneeId !== uid) {
        throw new Error('只有被指派人才能提交此任务');
    }

    // 更新状态为待确认
    await rest(`/classes/Todo/${todo.objectId}`, {
        method: 'PUT',
        body: JSON.stringify({
            status: 'pending_approval'
        })
    });

    // 通知创建者 (如果不是自己)
    if (todo.creatorId && todo.creatorId !== uid) {
        try {
            const currentUser = getCurrentUser();
            await sendNotification(
                todo.creatorId,
                'task_submitted',
                '任务待验收',
                `${currentUser?.username || '伴侣'} 完成了任务“${todo.content}”，请验收！`,
                todo.objectId
            );
        } catch (e) {
            console.warn('通知发送失败，但不影响任务提交', e);
        }
    }
};

export const approveTaskCompletion = async (todo: BackendTodo): Promise<void> => {
    if (!todo.objectId) return;
    const uid = getCurrentUserId();
    if (!uid) throw new Error('Not logged in');

    // 只有 creator 可以验收任务
    if (todo.creatorId && todo.creatorId !== uid) {
        throw new Error('只有发布人才能验收此任务');
    }

    // 1. 更新状态
    await rest(`/classes/Todo/${todo.objectId}`, {
        method: 'PUT',
        body: JSON.stringify({
            status: 'completed',
            isCompleted: true
        })
    });

    // 2. 发放奖励 (如果 reward > 0 且 assignee 存在)
    if (todo.rewardPoints && todo.rewardPoints > 0 && todo.assigneeId) {
        // 获取 Assignee 的 Profile
        const query = encodeURIComponent(JSON.stringify({ userId: todo.assigneeId }));
        const list = await safeQuery(`/classes/UserProfile_v2?where=${query}&limit=1`);
        
        if (Array.isArray(list.results) && list.results.length > 0) {
            const assigneeProfile = list.results[0];
            // 修正：使用 rest 直接调用，绕过 updateUserProfileFields 的本地所有权检查
            // 因为此时是 Creator 给 Assignee 发分，userId 不一致是预期的
            try {
                await rest(`/classes/UserProfile_v2/${assigneeProfile.objectId}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        points: (assigneeProfile.points || 0) + todo.rewardPoints
                    })
                });
            } catch (e) {
                console.warn('积分发放失败 (可能是权限不足，对方需登录 App 以更新 ACL)', e);
                // 这里我们吞掉错误，不让整个验收流程失败。
                // 此时任务状态已变更为 completed，只是积分没加上。
                // 这比任务卡在“待验收”且报错要好。
            }
        } else {
            console.warn('未找到 Assignee Profile，无法发放积分');
        }
    }

    // 3. 发送通知 (如果 assignee 不是自己)
    if (todo.assigneeId && todo.assigneeId !== uid) {
        try {
            await sendNotification(
                todo.assigneeId,
                'task_completed',
                '任务已验收',
                `任务“${todo.content}”已通过验收，获得 ${todo.rewardPoints || 0} 积分`,
                todo.objectId
            );
        } catch (e) {
            console.warn('通知发送失败，但不影响任务验收', e);
        }
    }
};

export const rejectTaskCompletion = async (todo: BackendTodo): Promise<void> => {
    if (!todo.objectId) return;
    const uid = getCurrentUserId();
    if (!uid) throw new Error('Not logged in');

    if (todo.creatorId && todo.creatorId !== uid) {
        throw new Error('只有发布人才能操作');
    }

    // 退回状态为 pending
    await rest(`/classes/Todo/${todo.objectId}`, {
        method: 'PUT',
        body: JSON.stringify({
            status: 'pending'
        })
    });

    // 通知 assignee
    if (todo.assigneeId && todo.assigneeId !== uid) {
        try {
            await sendNotification(
                todo.assigneeId,
                'task_rejected',
                '任务未通过',
                `任务“${todo.content}”未通过验收，请重新确认`,
                todo.objectId
            );
        } catch (e) {
            console.warn('通知发送失败，但不影响任务驳回', e);
        }
    }
};

export const completeTodo = async (todo: BackendTodo): Promise<void> => {
  // Legacy support or simple self-task completion
  if (!todo.objectId) return;
  
  // 如果是需要走验收流程的任务 (assignee != creator)，转交给 submitTaskCompletion
  // 但这里需要判断当前是 Creator 还是 Assignee 调用
  // 如果是 Creator 自己完成自己的任务，直接 complete
  // 如果是 Assignee 完成 Partner 的任务，走 submit
  
  const uid = getCurrentUserId();
  if (!uid) throw new Error('Not logged in');

  if (todo.creatorId && todo.assigneeId && todo.creatorId !== todo.assigneeId) {
      if (uid === todo.assigneeId) {
          // 我是被指派人 -> 提交验收
          return submitTaskCompletion(todo);
      } else if (uid === todo.creatorId) {
          // 我是创建人 -> 直接验收 (可能用于强制完成)
          return approveTaskCompletion(todo);
      }
  }

  // 正常流程 (自己给自己布置的任务)
  if (todo.assigneeId && todo.assigneeId !== uid) {
      throw new Error('只有被指派人才能完成此任务');
  }

  // 1. 更新状态
  await rest(`/classes/Todo/${todo.objectId}`, {
    method: 'PUT',
    body: JSON.stringify({
      status: 'completed',
      isCompleted: true
    })
  });

  // 2. 发放奖励 (如果 reward > 0 且 assignee 存在)
  if (todo.rewardPoints && todo.rewardPoints > 0) {
      const assigneeProfile = await getOrCreateUserProfile(); // 假设当前用户就是 assignee
      await updateUserProfileFields(assigneeProfile, { 
          points: (assigneeProfile.points || 0) + todo.rewardPoints 
      });
  }
};

export const bindPartner = async (targetUsername: string): Promise<void> => {
    const currentUser = getCurrentUser();
    const uid = getCurrentUserId();
    if (!currentUser || !uid) throw new Error('未登录');

    // 🔴 防止绑定自己 (用户名检查)
    if (targetUsername === currentUser.username) {
        throw new Error('不能绑定自己为情侣哦！');
    }

    // 1. 获取自己的最新名字 (可选，为了保险)
    // 2. 在 UserProfile 表中搜索目标用户名
    const query = encodeURIComponent(JSON.stringify({ username: targetUsername }));
    
    // 使用 try-catch 捕获 101 错误
    let list;
    try {
      list = await rest(`/classes/UserProfile_v2?where=${query}&limit=1`, { method: 'GET' });
    } catch (e: any) {
      // 如果表不存在(101)，说明对方还没注册过 App
      if (e.message === 'BMOB_CLASS_NOT_FOUND') {
         throw new Error('找不到该用户：对方可能还未登录过 App');
      }
      throw e;
    }

    if (!list.results || list.results.length === 0) {
      throw new Error('找不到该用户。若确认用户名无误，请让对方先登录一次 App 以同步数据。');
    }

    const targetProfile = list.results[0];

    // 🔴 防止绑定自己 (ID检查)
    if (targetProfile.userId === uid) {
        throw new Error('不能绑定自己为情侣哦！');
    }
    
    // 3. 发送通知
    // 优先使用昵称
    let requesterName = currentUser.username;
    try {
        const myProfile = await getOrCreateUserProfile();
        requesterName = myProfile.nickname || currentUser.username;
    } catch (e) { console.warn('获取昵称失败', e); }

    await sendNotification(
      targetProfile.userId, // 注意：这里是对方的 userId (不是 objectId)
      'bind_request',
      '情侣绑定邀请',
      `${requesterName} 想与你绑定情侣关系`,
      uid // 关联 ID 传自己的 User ID
    );
};

export const confirmBind = async (requesterId: string, notificationId: string, requesterName: string): Promise<void> => {
    const currentUserId = getCurrentUserId();
    const currentUser = getCurrentUser(); 
    
    if (!currentUserId) throw new Error('未登录');

    // 步骤 1: 查询发起人 (A) 的档案
    // 由于 ACL 已改为公有读，这里可以直接查询到
    const requesterProfileQuery = encodeURIComponent(JSON.stringify({ userId: requesterId }));
    const requesterProfileList = await safeQuery(`/classes/UserProfile_v2?where=${requesterProfileQuery}&limit=1`);
    
    // 如果查不到对方档案，说明对方可能还没升级到新 ACL 或未创建档案
    // 但即使如此，我们仍可以先完成自己这边的绑定，并通知对方
    // 尝试获取对方真实昵称 (从 User 表)
    let realRequesterName = requesterName;
    try {
        const requesterUser = await rest(`/users/${requesterId}`, { method: 'GET' });
        if (requesterUser && requesterUser.username) {
            realRequesterName = requesterUser.username;
        }
    } catch (e) {
        console.warn('获取发起人真实用户名失败，使用默认值', e);
    }

    // 步骤 2: 更新当前用户 (B) 的档案
    const myProfile = await getOrCreateUserProfile();
    await updateUserProfileFields(myProfile, { 
        partnerId: requesterId,
        partnerName: realRequesterName 
    });

    // 步骤 3: 给发起人 (A) 发送 'bind_accepted' 通知
    // 注意：不再直接修改 A 的档案，因为没有写权限
    await sendNotification(
        requesterId,
        'bind_accepted',
        '绑定成功',
        `${currentUser?.username || '对方'} 已同意绑定，点击生效！`,
        currentUserId
    );

    // 步骤 4: 删除原有的请求通知
    await deleteNotification(notificationId);
};

export const finalizeBind = async (partnerId: string, partnerName: string, notificationId: string): Promise<void> => {
    const uid = getCurrentUserId();
    if (!uid) throw new Error('Not logged in');

    // 尝试获取对方真实昵称 (从 User 表)
    let realPartnerName = partnerName;
    try {
        const partnerUser = await rest(`/users/${partnerId}`, { method: 'GET' });
        if (partnerUser && partnerUser.username) {
            realPartnerName = partnerUser.username;
        }
    } catch (e) {
        console.warn('获取对方真实用户名失败，使用默认值', e);
    }

    // 1. 更新当前用户 (A) 的档案
    const myProfile = await getOrCreateUserProfile();
    await updateUserProfileFields(myProfile, {
        partnerId: partnerId,
        partnerName: realPartnerName
    });

    // 2. 删除 'bind_accepted' 通知
    await deleteNotification(notificationId);
};

import { subDays, startOfDay, isBefore, parseISO } from 'date-fns';
import { SHOP_ITEMS, PUNISHMENTS } from '../utils/constants';

export interface InventoryItem {
    objectId?: string;
    userId: string;
    itemId: string;
    itemName: string;
    status: 'unused' | 'used';
    createdAt?: string;
}


export const processExpiredTasks = async (): Promise<void> => {
    const uid = getCurrentUserId();
    if (!uid) return;

    const todayStr = new Date().toISOString().split('T')[0];
    
    const queryObj = {
        userId: uid, // 我创建的
        status: 'pending',
        date: { "$lt": todayStr }
    };
    const query = encodeURIComponent(JSON.stringify(queryObj));
    const list = await safeQuery(`/classes/Todo?where=${query}&limit=100`);

    if (!Array.isArray(list.results) || list.results.length === 0) return;

    console.log(`🧹 [Task] 发现 ${list.results.length} 个过期任务，开始处理...`);

    let refundTotal = 0;
    
    for (const task of list.results) {
        // 处理强制任务惩罚
        if (task.type === 'forced_task') {
            const punishment = PUNISHMENTS[Math.floor(Math.random() * PUNISHMENTS.length)];
            
            await rest(`/classes/Todo/${task.objectId}`, {
                method: 'PUT',
                body: JSON.stringify({ 
                    status: 'expired',
                    isPunished: true,
                    punishmentContent: punishment
                })
            });

            // 通知执行人 (对方)
            if (task.assigneeId) {
                try {
                    await sendNotification(
                        task.assigneeId,
                        'task_expired',
                        '☠️ 任务超时惩罚生效！',
                        `强制任务“${task.content}”未完成！惩罚：${punishment}`,
                        task.objectId
                    );
                } catch (e) { console.warn('通知失败', e); }
            }
            
            // 通知创建人 (自己)
            await sendNotification(
                uid,
                'task_expired',
                '😈 对方受到惩罚',
                `对方未完成强制任务，已触发惩罚：${punishment}`,
                task.objectId
            );
            
            // 强制任务不退分
            continue;
        }

        // 普通任务过期处理
        await rest(`/classes/Todo/${task.objectId}`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'expired' })
        });
        
        // 统计退款
        if (task.rewardPoints && task.rewardPoints > 0) {
            refundTotal += task.rewardPoints;
            
            // 发送通知
            await sendNotification(
                uid, // 发给自己
                'task_expired',
                '任务过期退分',
                `任务“${task.content}”已过期，${task.rewardPoints} 积分已退回`,
                task.objectId
            );
        }
    }

    // 批量退款
    if (refundTotal > 0) {
        const profile = await getOrCreateUserProfile();
        await updateUserProfileFields(profile, {
            points: (profile.points || 0) + refundTotal
        });
        console.log(`💰 [Task] 已退还 ${refundTotal} 积分`);
    }
};

export const deleteTodo = async (id: string): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('FORBIDDEN');
  
  // 可以在这里先 get 一次检查权限，或者直接 delete (Bmob ACL 会拦截)
  // 为了严谨，建议依赖 ACL，这里直接调删
  await rest(`/classes/Todo/${id}`, {
    method: 'DELETE'
  });
};

export const buyItem = async (itemId: string, cost: number): Promise<void> => {
    const uid = getCurrentUserId();
    if (!uid) throw new Error('Not logged in');

    const itemInfo = SHOP_ITEMS.find(i => i.id === itemId);
    if (!itemInfo) throw new Error('商品不存在');

    // 1. Check Balance & Deduct Points
    const profile = await getOrCreateUserProfile();
    if ((profile.points || 0) < cost) {
        throw new Error('积分不足');
    }

    // Atomic-like operation? Bmob doesn't support transactions easily via REST without Cloud Code.
    // We will deduct points first.
    await updateUserProfileFields(profile, {
        points: (profile.points || 0) - cost
    });

    try {
        // 2. Add to Inventory
        await rest('/classes/InventoryItem', {
            method: 'POST',
            body: JSON.stringify({
                userId: uid,
                itemId,
                itemName: itemInfo.name,
                status: 'unused',
                ACL: { [uid]: { read: true, write: true } }
            })
        });
    } catch (e) {
        // Rollback points if inventory fails (best effort)
        console.error('Inventory creation failed, refunding points...', e);
        await updateUserProfileFields(profile, {
            points: (profile.points || 0) // Reset to original? No, we just subtracted. Add it back.
            // Wait, profile.points is the OLD value.
            // We just updated it.
            // Let's just add cost back.
        });
        // Re-fetch to be safe
        const current = await getOrCreateUserProfile();
        await updateUserProfileFields(current, {
             points: (current.points || 0) + cost
        });
        throw new Error('购买失败，积分已退回');
    }
};

export const getMyInventory = async (): Promise<InventoryItem[]> => {
    const uid = getCurrentUserId();
    if (!uid) return [];

    const query = encodeURIComponent(JSON.stringify({
        userId: uid,
        status: 'unused'
    }));
    const list = await safeQuery(`/classes/InventoryItem?where=${query}&order=-createdAt`);
    return list.results || [];
};

export const useItem = async (inventoryId: string, itemId: string): Promise<void> => {
    const uid = getCurrentUserId();
    if (!uid) throw new Error('Not logged in');

    const profile = await getOrCreateUserProfile();
    if (!profile.partnerId) {
        throw new Error('你需要先绑定伴侣才能使用此道具！');
    }

    const itemInfo = SHOP_ITEMS.find(i => i.id === itemId);
    const itemName = itemInfo ? itemInfo.name : '神秘道具';

    // 1. Consume Item
    await rest(`/classes/InventoryItem/${inventoryId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'used' })
    });

    // 2. Create Forced Task
    const todayStr = new Date().toISOString().split('T')[0];
    await rest('/classes/Todo', {
        method: 'POST',
        body: JSON.stringify({
            userId: uid, // Creator
            assigneeId: profile.partnerId, // Target
            content: `[强制] 对方对你使用了道具：${itemName}`,
            date: todayStr,
            status: 'pending',
            type: 'forced_task',
            isPunished: false,
            ACL: {
                [uid]: { read: true, write: true },
                [profile.partnerId]: { read: true, write: true }
            }
        })
    });

    // 3. Notify Partner
    await sendNotification(
        profile.partnerId,
        'system',
        '⚡️ 遭到道具攻击！',
        `${profile.username || '对方'} 对你使用了【${itemName}】，请立即查看任务列表！`,
        inventoryId
    );
};

export const register = async (username: string, password: string, email?: string) => {
  logout();
  const user = await rest('/users', {
    method: 'POST',
    body: JSON.stringify({ username, password, ...(email ? { email } : {}) })
  });
  // 手动补充 username，因为注册接口可能不返回它，导致首次登录时 username 为 undefined
  const userWithInfo = { ...user, username, ...(email ? { email } : {}) };
  setSession(userWithInfo);
  return userWithInfo;
};

// ==================== 通知系统 API ====================

export const sendNotification = async (
    targetUserId: string, 
    type: string, 
    title: string, 
    content: string, 
    relatedId?: string,
    extraData?: any
): Promise<void> => {
    const uid = getCurrentUserId();
    if (!uid) throw new Error('Not logged in');

    // 只有目标用户可读写 (ACL)
    const acl = { 
        [targetUserId]: { read: true, write: true },
        // 发送者也需要写权限吗？不需要，发送后就归对方了。
        // 但 Bmob 创建时如果不指定，默认可能是 Public? 
        // 我们显式指定 ACL
    };

    await rest('/classes/Notification', {
        method: 'POST',
        body: JSON.stringify({
            userId: targetUserId,
            type,
            title,
            content,
            isRead: false,
            relatedId,
            extraData,
            ACL: acl
        })
    });
};

export const getMyNotifications = async (limit = 20): Promise<BackendNotification[]> => {
    const uid = getCurrentUserId();
    if (!uid) return [];

    const query = encodeURIComponent(JSON.stringify({ userId: uid }));
    const list = await safeQuery(`/classes/Notification?where=${query}&order=-createdAt&limit=${limit}`);
    
    if (!Array.isArray(list.results)) return [];
    return list.results;
};

export const markNotificationAsRead = async (id: string): Promise<void> => {
    await rest(`/classes/Notification/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isRead: true })
    });
};

export const markAllNotificationsAsRead = async (): Promise<void> => {
    const uid = getCurrentUserId();
    if (!uid) return;

    // Bmob 不支持直接 update where，只能先查后更
    const notifications = await getMyNotifications(50);
    const unread = notifications.filter(n => !n.isRead);
    
    // 使用 Batch 接口
    if (unread.length === 0) return;

    const requests = unread.map(n => ({
        method: 'PUT',
        path: `/1/classes/Notification/${n.objectId}`,
        body: { isRead: true }
    }));

    // 简单的分批处理 (假设不超过 50 个未读)
    await rest('/batch', {
        method: 'POST',
        body: JSON.stringify({ requests: requests.slice(0, 50) })
    });
};

export const deleteNotification = async (id: string): Promise<void> => {
    await rest(`/classes/Notification/${id}`, { method: 'DELETE' });
};