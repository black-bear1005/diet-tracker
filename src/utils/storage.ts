import { UserProfile, DailyRecord, FoodItem, ExerciseItem } from '../types';
import {
  initBmob,
  isBmobReady,
  getOrCreateUserProfile as getOrCreateUserProfileBackend,
  updateUserProfileFields,
  getOrCreateDailyLog as getOrCreateDailyLogBackend,
  updateDailyLogFields,
  fetchAllDailyLogs,
  logout,
  getCurrentUser,
  seedFoodLibrary
} from '../services/bmob';
import foodData from './foodData.json';

initBmob();
if (typeof window !== 'undefined') {
  window.addEventListener('bmob-ready', () => {
    initBmob();
  });
  
  // 临时：每次加载时尝试初始化食物库
  // 在实际生产中，这应该由管理员触发，或者只在 dev 环境运行
  // 但为了满足用户需求，我们在这里调用它
  setTimeout(() => {
      seedFoodLibrary(foodData).catch(err => console.error('Food seeding failed:', err));
  }, 3000);
}

const calcAgeFromBirthday = (birthday?: string): number | null => {
  if (!birthday) return null;
  const [y, m, d] = birthday.split('-').map(Number);
  const b = new Date(y, (m || 1) - 1, d || 1);
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const mm = today.getMonth() - b.getMonth();
  if (mm < 0 || (mm === 0 && today.getDate() < b.getDate())) age--;
  return age;
};

const mapBackendProfileToUserProfile = async (): Promise<UserProfile> => {
  const p = await getOrCreateUserProfileBackend();
  const age = calcAgeFromBirthday(p.birthday) ?? 25;
  const logs = await fetchAllDailyLogs(10);
  const latestWeight = logs.length ? (logs[logs.length - 1].weight ?? 70) : 70;
  const effectiveWeight = p.weight && p.weight > 0 ? p.weight : latestWeight;
  return {
    gender: p.gender === 'female' ? 'female' : 'male',
    age,
    height: p.height,
    weight: effectiveWeight,
    activityLevel: p.activityLevel,
    calorieDeficit: p.targetDeficit,
    partnerId: p.partnerId,
    partnerName: p.partnerName,
    points: p.points ?? 100,
    nickname: p.nickname,
    avatarUrl: p.avatarUrl,
    username: p.username,
    createdAt: p.createdAt
  };
};

const mapBackendDailyToRecord = (d: any): DailyRecord => {
  const foods: FoodItem[] = Array.isArray(d.foodIntake)
    ? d.foodIntake.map((it: any, idx: number) => ({
        id: `${d.objectId || 'row'}-f-${idx}-${Date.now()}`,
        name: it.name || it.title || '食物',
        calories: Number(it.kcal || it.calories || 0),
        protein: it.protein ? Number(it.protein) : undefined,
        fat: it.fat ? Number(it.fat) : undefined,
        carbs: it.carbs ? Number(it.carbs) : undefined,
        servingSize: it.servingSize,
        unit: it.unit,
        image: it.image
      }))
    : [];

  const exercises: ExerciseItem[] = Array.isArray(d.exercise)
    ? d.exercise.map((it: any, idx: number) => ({
        id: `${d.objectId || 'row'}-e-${idx}-${Date.now()}`,
        name: it.type || it.name || '运动',
        duration: Number(it.mins || it.duration || 0),
        calories: Number(it.kcal || it.calories || 0)
      }))
    : [];

  return {
    date: d.date,
    weight: d.weight ?? undefined,
    foods,
    exercises
  };
};

const mapRecordToBackendDailyFields = (record: DailyRecord) => {
  return {
    date: record.date,
    weight: record.weight ?? null,
    foodIntake: (record.foods || []).map(f => ({
      name: f.name,
      kcal: f.calories,
      protein: f.protein,
      fat: f.fat,
      carbs: f.carbs,
      servingSize: f.servingSize,
      unit: f.unit,
      image: f.image
    })),
    exercise: (record.exercises || []).map(e => ({ type: e.name, mins: e.duration, kcal: e.calories }))
  };
};

export const loadUserProfile = async (): Promise<UserProfile | null> => {
  if (!isBmobReady()) return null;
  try {
    // 仅在已登录情况下加载
    if (!(await getCurrentUser())) return null;
    return await mapBackendProfileToUserProfile();
  } catch (error: any) {
    console.error('Error loading user profile from Bmob:', error);
    if (error?.status === 401 || String(error?.message || '').includes('401')) {
      await logout();
      return null;
    }
    return null;
  }
};

export const saveUserProfile = async (profile: UserProfile): Promise<void> => {
  if (!isBmobReady()) return;
  try {
    const backend = await getOrCreateUserProfileBackend();
    const currentYear = new Date().getFullYear();
    const birthdayYear = Math.max(1900, currentYear - (profile.age || 0));
    const birthday = `${birthdayYear}-01-01`;
    await updateUserProfileFields(backend, {
      gender: profile.gender,
      height: profile.height,
      targetDeficit: profile.calorieDeficit,
      activityLevel: profile.activityLevel,
      birthday,
      weight: profile.weight,
      nickname: profile.nickname,
      avatarUrl: profile.avatarUrl
    });
  } catch (error) {
    console.error('Error saving user profile to Bmob:', error);
  }
};

export const updateUserAvatar = async (avatarUrl: string): Promise<void> => {
  if (!isBmobReady()) return;
  try {
    const backend = await getOrCreateUserProfileBackend();
    await updateUserProfileFields(backend, { avatarUrl });
  } catch (error) {
    console.error('Error updating avatar:', error);
    throw error;
  }
};

export const loadDailyRecords = async (): Promise<DailyRecord[]> => {
  if (!isBmobReady()) return [];
  try {
    if (!getCurrentUser()) return [];
    const rows = await fetchAllDailyLogs(120);
    return rows.map(mapBackendDailyToRecord);
  } catch (error) {
    console.error('Error loading daily records from Bmob:', error);
    return [];
  }
};

export const getDailyRecord = async (date: string): Promise<DailyRecord | undefined> => {
  if (!isBmobReady()) return undefined;
  try {
    if (!getCurrentUser()) return undefined;
    const daily = await getOrCreateDailyLogBackend(date);
    return mapBackendDailyToRecord(daily);
  } catch (error) {
    console.error('Error getting daily record from Bmob:', error);
    return undefined;
  }
};

export const updateDailyRecord = async (record: DailyRecord): Promise<void> => {
  if (!isBmobReady()) return;
  try {
    if (!(await getCurrentUser())) return;
    const daily = await getOrCreateDailyLogBackend(record.date);
    const fields = mapRecordToBackendDailyFields(record);
    await updateDailyLogFields(daily, fields as any);
  } catch (error) {
    console.error('Error updating daily record to Bmob:', error);
  }
};
