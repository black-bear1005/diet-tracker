export interface UserProfile {
  username?: string; // Login ID (Unique)
  nickname?: string; // Display Name
  avatarUrl?: string; // Avatar Image URL
  createdAt?: string;
  gender: 'male' | 'female';
  age: number;
  height: number; // cm
  weight: number; // kg
  activityLevel: number; // 1.2, 1.375, 1.55, etc.
  calorieDeficit: number; // default 500 kcal
  points?: number;
  partnerId?: string;
  partnerName?: string;
  isProfileCompleted?: boolean;
}

export interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  servingSize?: string; // e.g. "1.5份" or "150克"
  unit?: string;
  image?: string; // Image URL or Base64
}

export interface FoodLibraryItem {
  objectId?: string;
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  unit: string;
}

export interface ExerciseItem {
  id: string;
  name: string;
  duration: number; // minutes
  calories: number;
}

export interface DailyRecord {
  date: string; // YYYY-MM-DD
  weight?: number;
  foods: FoodItem[];
  exercises: ExerciseItem[];
}

export interface CalculatedMetrics {
  bmi: number;
  bmr: number;
  tdee: number;
  dailyCalorieLimit: number;
  bmiCategory: string;
}