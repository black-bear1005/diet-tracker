const APP_ID = import.meta.env.VITE_BMOB_APP_ID;
const API_KEY = import.meta.env.VITE_BMOB_API_KEY;

export const isBmobReady = (): boolean => {
  return typeof Bmob !== 'undefined' && !!APP_ID && !!API_KEY;
};

export const initBmob = (): void => {
  if (isBmobReady()) {
    Bmob.initialize(APP_ID, API_KEY);
  } else {
    console.warn('Bmob 未配置：请在 .env 中设置 VITE_BMOB_APP_ID 与 VITE_BMOB_API_KEY');
  }
};

export interface BackendUserProfile {
  objectId?: string;
  gender: 'male' | 'female' | string;
  height: number;
  birthday: string; // YYYY-MM-DD
  targetDeficit: number;
  activityLevel: number;
}

export interface BackendDailyLog {
  objectId?: string;
  date: string; // YYYY-MM-DD
  weight?: number | null;
  foodIntake: Array<{ name: string; kcal: number }>;
  exercise: Array<{ type?: string; name?: string; mins?: number; kcal: number }>;
}

export const getOrCreateUserProfile = async (): Promise<BackendUserProfile> => {
  const query = Bmob.Query('UserProfile');
  const rows = await query.find();
  if (Array.isArray(rows) && rows.length > 0) return rows[0];

  const q = Bmob.Query('UserProfile');
  q.set('gender', 'male');
  q.set('height', 170);
  q.set('birthday', '1990-01-01');
  q.set('targetDeficit', 500);
  q.set('activityLevel', 1.375);
  const saved = await q.save();
  const objId = saved.objectId;
  const refetch = Bmob.Query('UserProfile');
  return await refetch.get(objId);
};

export const updateUserProfileFields = async (
  profile: BackendUserProfile,
  fields: Partial<BackendUserProfile>
) => {
  const q = Bmob.Query('UserProfile');
  const obj = await q.get(profile.objectId);
  Object.entries(fields).forEach(([k, v]) => obj.set(k, v as any));
  return await obj.save();
};

export const getOrCreateDailyLog = async (date: string): Promise<BackendDailyLog> => {
  const query = Bmob.Query('DailyLog');
  query.equalTo('date', '==', date);
  const rows = await query.find();
  if (Array.isArray(rows) && rows.length > 0) return rows[0];

  const q = Bmob.Query('DailyLog');
  q.set('date', date);
  q.set('weight', null);
  q.set('foodIntake', []);
  q.set('exercise', []);
  const saved = await q.save();
  const objId = saved.objectId;
  const refetch = Bmob.Query('DailyLog');
  return await refetch.get(objId);
};

export const updateDailyLogFields = async (
  daily: BackendDailyLog,
  fields: Partial<BackendDailyLog>
) => {
  const q = Bmob.Query('DailyLog');
  const obj = await q.get(daily.objectId);
  Object.entries(fields).forEach(([k, v]) => obj.set(k, v as any));
  return await obj.save();
};

export const fetchAllDailyLogs = async (limit = 120): Promise<BackendDailyLog[]> => {
  const q = Bmob.Query('DailyLog');
  q.order('date');
  q.limit(limit);
  const rows = await q.find();
  return Array.isArray(rows) ? rows : [];
};

