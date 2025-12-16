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
  user?: { __type: 'Pointer'; className: '_User'; objectId: string };
  gender: 'male' | 'female' | string;
  height: number;
  birthday: string;
  targetDeficit: number;
  activityLevel: number;
  weight?: number;
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

const getSessionToken = () => { try { return localStorage.getItem(LS_KEYS.sessionToken); } catch { return null; } };
const getCurrentUserId = () => {
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
      if (errObj.code === 101) throw new Error('BMOB_CLASS_NOT_FOUND');
      if (res.status === 401) logout();
      throw new Error(`Bmob Error ${res.status}: ${errObj.error || text}`);
    } catch (e: any) {
      if (e.message === 'BMOB_CLASS_NOT_FOUND') throw e;
      throw new Error(`Bmob Error ${res.status}: ${text}`);
    }
  }
  return res.json();
};

const safeQuery = async (path: string) => {
  try { return await rest(path, { method: 'GET' }); } 
  catch (err: any) {
    if (err.message === 'BMOB_CLASS_NOT_FOUND') return { results: [] };
    throw err;
  }
};

// ==================== 业务逻辑 (保持 userId 绑定) ====================

export const getOrCreateUserProfile = async (): Promise<BackendUserProfile> => {
  const uid = getCurrentUserId();
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
    return profile;
  }
  
  console.log('✨ [Profile] 未找到匹配档案，创建新档案 for:', uid);
  const saved = await rest('/classes/UserProfile_v2', {
    method: 'POST',
    body: JSON.stringify({
      userId: uid,
      user: { __type: 'Pointer', className: '_User', objectId: uid },
      gender: 'male',
      height: 170,
      birthday: '1990-01-01',
      targetDeficit: 500,
      activityLevel: 1.375,
      weight: 70, // 默认体重
      ACL: { [uid]: { read: true, write: true } }
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

export const register = async (username: string, password: string, email?: string) => {
  logout();
  const user = await rest('/users', {
    method: 'POST',
    body: JSON.stringify({ username, password, ...(email ? { email } : {}) })
  });
  setSession(user);
  return user;
};
