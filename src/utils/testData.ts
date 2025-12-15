import { UserProfile, DailyRecord } from '../types';

export const createTestUserProfile = (): UserProfile => ({
  gender: 'male',
  age: 30,
  height: 175,
  weight: 75,
  activityLevel: 1.375,
  calorieDeficit: 500
});

export const createTestDailyRecords = (): DailyRecord[] => {
  const records: DailyRecord[] = [];
  const today = new Date();
  
  // Create 7 days of test data
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    records.push({
      date: dateStr,
      weight: 75 - (i * 0.2), // Gradual weight loss
      foods: [
        { id: `${dateStr}-1`, name: '早餐', calories: 400 },
        { id: `${dateStr}-2`, name: '午餐', calories: 600 },
        { id: `${dateStr}-3`, name: '晚餐', calories: 500 }
      ],
      exercises: [
        { id: `${dateStr}-1`, name: '快走', duration: 30, calories: 150 },
        { id: `${dateStr}-2`, name: '力量训练', duration: 45, calories: 200 }
      ]
    });
  }
  
  return records;
};

// Test function to verify calculations
export const testCalculations = () => {
  const profile = createTestUserProfile();
  
  // Test BMI calculation
  const bmi = profile.weight / Math.pow(profile.height / 100, 2);
  console.log('BMI:', bmi.toFixed(1));
  
  // Test BMR calculation (Mifflin-St Jeor for male)
  const bmr = (10 * profile.weight) + (6.25 * profile.height) - (5 * profile.age) + 5;
  console.log('BMR:', bmr.toFixed(0), 'kcal');
  
  // Test TDEE calculation
  const tdee = bmr * profile.activityLevel;
  console.log('TDEE:', tdee.toFixed(0), 'kcal');
  
  // Test daily calorie limit
  const dailyLimit = tdee - profile.calorieDeficit;
  console.log('Daily Limit:', dailyLimit.toFixed(0), 'kcal');
  
  return { bmi, bmr, tdee, dailyLimit };
};