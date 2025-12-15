import { UserProfile, DailyRecord, FoodItem, ExerciseItem } from '../types';
import {
  initBmob,
  isBmobReady,
  getOrCreateUserProfile as getOrCreateUserProfileBackend,
  updateUserProfileFields,
  getOrCreateDailyLog as getOrCreateDailyLogBackend,
  updateDailyLogFields,
  fetchAllDailyLogs
} from '../services/bmob';

initBmob();
if (typeof window !== 'undefined') {
  window.addEventListener('bmob-ready', () => {
    initBmob();
  });
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
  // 尝试用最近一条体重作为当前体重（取最后一条）
  const logs = await fetchAllDailyLogs(10);
  const latestWeight = logs.length ? (logs[logs.length - 1].weight ?? 70) : 70;
  return {
    gender: p.gender === 'female' ? 'female' : 'male',
    age,
    height: p.height,
    weight: latestWeight,
    activityLevel: p.activityLevel,
    calorieDeficit: p.targetDeficit
  };
};

const mapBackendDailyToRecord = (d: any): DailyRecord => {
  const foods: FoodItem[] = Array.isArray(d.foodIntake)
    ? d.foodIntake.map((it: any, idx: number) => ({
        id: `${d.objectId || 'row'}-f-${idx}-${Date.now()}`,
        name: it.name || it.title || '食物',
        calories: Number(it.kcal || it.calories || 0)
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
    foodIntake: (record.foods || []).map(f => ({ name: f.name, kcal: f.calories })),
    exercise: (record.exercises || []).map(e => ({ type: e.name, mins: e.duration, kcal: e.calories }))
  };
};

export const loadUserProfile = async (): Promise<UserProfile | null> => {
  if (!isBmobReady()) return null;
  try {
    return await mapBackendProfileToUserProfile();
  } catch (error) {
    console.error('Error loading user profile from Bmob:', error);
    return null;
  }
};

export const saveUserProfile = async (profile: UserProfile): Promise<void> => {
  if (!isBmobReady()) return;
  try {
    const backend = await getOrCreateUserProfileBackend();
    await updateUserProfileFields(backend, {
      gender: profile.gender,
      height: profile.height,
      targetDeficit: profile.calorieDeficit,
      activityLevel: profile.activityLevel
      // birthday 不从 age 反推，保留已有 birthday
    });
  } catch (error) {
    console.error('Error saving user profile to Bmob:', error);
  }
};

export const loadDailyRecords = async (): Promise<DailyRecord[]> => {
  if (!isBmobReady()) return [];
  try {
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
    const daily = await getOrCreateDailyLogBackend(record.date);
    const fields = mapRecordToBackendDailyFields(record);
    await updateDailyLogFields(daily, fields as any);
  } catch (error) {
    console.error('Error updating daily record to Bmob:', error);
  }
};
