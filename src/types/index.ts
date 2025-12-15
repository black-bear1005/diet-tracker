export interface UserProfile {
  gender: 'male' | 'female';
  age: number;
  height: number; // cm
  weight: number; // kg
  activityLevel: number; // 1.2, 1.375, 1.55, etc.
  calorieDeficit: number; // default 500 kcal
}

export interface FoodItem {
  id: string;
  name: string;
  calories: number;
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