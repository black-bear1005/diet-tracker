import { calculateBMI, calculateBMR, calculateTDEE, calculateDailyCalorieLimit, getBMICategory, estimateExerciseCalories } from '../utils/calculations';
import { UserProfile } from '../types';

describe('Health Calculations', () => {
  const testProfile: UserProfile = {
    gender: 'male',
    age: 30,
    height: 175, // cm
    weight: 75, // kg
    activityLevel: 1.375,
    calorieDeficit: 500
  };

  describe('BMI Calculation', () => {
    it('should calculate BMI correctly', () => {
      const bmi = calculateBMI(75, 175);
      expect(bmi).toBeCloseTo(24.5, 1);
    });

    it('should return correct BMI category', () => {
      expect(getBMICategory(18.0)).toBe('偏瘦');
      expect(getBMICategory(22.0)).toBe('正常');
      expect(getBMICategory(26.0)).toBe('超重');
      expect(getBMICategory(30.0)).toBe('肥胖');
    });
  });

  describe('BMR Calculation', () => {
    it('should calculate BMR for male correctly', () => {
      const bmr = calculateBMR(testProfile);
      // (10 * 75) + (6.25 * 175) - (5 * 30) + 5 = 750 + 1093.75 - 150 + 5 = 1698.75
      expect(bmr).toBeCloseTo(1698.75, 0);
    });

    it('should calculate BMR for female correctly', () => {
      const femaleProfile: UserProfile = { ...testProfile, gender: 'female' };
      const bmr = calculateBMR(femaleProfile);
      // (10 * 75) + (6.25 * 175) - (5 * 30) - 161 = 750 + 1093.75 - 150 - 161 = 1532.75
      expect(bmr).toBeCloseTo(1532.75, 0);
    });
  });

  describe('TDEE Calculation', () => {
    it('should calculate TDEE correctly', () => {
      const bmr = 1698.75;
      const tdee = calculateTDEE(bmr, 1.375);
      expect(tdee).toBeCloseTo(2335.78, 0);
    });
  });

  describe('Daily Calorie Limit', () => {
    it('should calculate daily calorie limit correctly', () => {
      const tdee = 2335.78;
      const limit = calculateDailyCalorieLimit(tdee, 500);
      expect(limit).toBeCloseTo(1835.78, 0);
    });
  });

  describe('Exercise Calorie Estimation', () => {
    it('should estimate walking calories correctly', () => {
      const calories = estimateExerciseCalories('快走', 30, 75);
      // 0.05 * 75 * 30 = 112.5
      expect(calories).toBeCloseTo(112.5, 0);
    });

    it('should estimate general exercise calories correctly', () => {
      const calories = estimateExerciseCalories('跑步', 30, 75);
      // 0.08 * 75 * 30 = 180
      expect(calories).toBeCloseTo(180, 0);
    });
  });
});