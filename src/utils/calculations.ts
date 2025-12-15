import { UserProfile, CalculatedMetrics } from '../types';

export const calculateBMI = (weight: number, height: number): number => {
  const heightInMeters = height / 100;
  return weight / (heightInMeters * heightInMeters);
};

export const getBMICategory = (bmi: number): string => {
  if (bmi < 18.5) return '偏瘦';
  if (bmi < 24) return '正常';
  if (bmi < 28) return '超重';
  return '肥胖';
};

export const calculateBMR = (profile: UserProfile): number => {
  const { gender, weight, height, age } = profile;
  
  if (gender === 'male') {
    return (10 * weight) + (6.25 * height) - (5 * age) + 5;
  } else {
    return (10 * weight) + (6.25 * height) - (5 * age) - 161;
  }
};

export const calculateTDEE = (bmr: number, activityLevel: number): number => {
  return bmr * activityLevel;
};

export const calculateDailyCalorieLimit = (tdee: number, calorieDeficit: number): number => {
  return tdee - calorieDeficit;
};

export const calculateMetrics = (profile: UserProfile): CalculatedMetrics => {
  const bmi = calculateBMI(profile.weight, profile.height);
  const bmr = calculateBMR(profile);
  const tdee = calculateTDEE(bmr, profile.activityLevel);
  const dailyCalorieLimit = calculateDailyCalorieLimit(tdee, profile.calorieDeficit);
  const bmiCategory = getBMICategory(bmi);
  
  return {
    bmi,
    bmr,
    tdee,
    dailyCalorieLimit,
    bmiCategory
  };
};

export const estimateExerciseCalories = (exerciseName: string, duration: number, weight: number): number => {
  if (exerciseName.toLowerCase().includes('快走') || exerciseName.toLowerCase().includes('walking')) {
    return 0.05 * weight * duration;
  }
  // Default estimation: 0.08 * weight * duration for moderate exercise
  return 0.08 * weight * duration;
};