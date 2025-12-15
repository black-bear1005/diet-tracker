import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  LineController,
  BarController
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { DailyRecord } from '../types';
import { format, parseISO, subDays } from 'date-fns';
import { TrendingUp, BarChart3, Scale } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  LineController,
  BarController
);

interface DashboardProps {
  dailyRecords: DailyRecord[];
  userProfile: any;
}

const Dashboard: React.FC<DashboardProps> = ({ dailyRecords, userProfile }) => {
  // Get last 30 days of data
  const getLast30DaysData = () => {
    const today = new Date();
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = subDays(today, 29 - i);
      return format(date, 'yyyy-MM-dd');
    });

    return last30Days.map(date => {
      const record = dailyRecords.find(r => r.date === date);
      return {
        date,
        weight: record?.weight,
        foodCalories: record?.foods.reduce((sum, food) => sum + food.calories, 0) || 0,
        exerciseCalories: record?.exercises.reduce((sum, exercise) => sum + exercise.calories, 0) || 0,
        netCalories: (record?.foods.reduce((sum, food) => sum + food.calories, 0) || 0) - (record?.exercises.reduce((sum, exercise) => sum + exercise.calories, 0) || 0)
      };
    });
  };

  const chartData = getLast30DaysData();

  // Weight trend chart
  const weightChartData = {
    labels: chartData.map(d => format(parseISO(d.date), 'MM/dd')),
    datasets: [
      {
        label: '体重 (kg)',
        data: chartData.map(d => d.weight),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.1,
        pointRadius: 4,
        pointHoverRadius: 6,
        spanGaps: true,
      }
    ]
  };

  const weightChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '体重变化趋势'
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `体重: ${context.parsed.y?.toFixed(1) || '无数据'} kg`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        title: {
          display: true,
          text: '体重 (kg)'
        }
      },
      x: {
        title: {
          display: true,
          text: '日期'
        }
      }
    }
  };

  // Calorie balance chart
  const calorieChartData = {
    labels: chartData.map(d => format(parseISO(d.date), 'MM/dd')),
    datasets: [
      {
        type: 'bar' as const,
        label: '摄入热量',
        data: chartData.map(d => d.foodCalories),
        backgroundColor: 'rgba(239, 68, 68, 0.7)',
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 1,
      },
      {
        type: 'bar' as const,
        label: '运动消耗',
        data: chartData.map(d => -d.exerciseCalories),
        backgroundColor: 'rgba(34, 197, 94, 0.7)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 1,
      },
      {
        type: 'line' as const,
        label: 'BMR基代线',
        data: Array(chartData.length).fill(userProfile?.bmr || 0),
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      },
      {
        type: 'line' as const,
        label: '建议摄入上限',
        data: Array(chartData.length).fill(userProfile?.dailyCalorieLimit || 0),
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      }
    ]
  };

  const calorieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '热量收支对比'
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const value = Math.abs(context.parsed.y);
            if (context.datasetIndex === 0) return `摄入: ${value} kcal`;
            if (context.datasetIndex === 1) return `运动消耗: ${value} kcal`;
            if (context.datasetIndex === 2) return `BMR: ${value} kcal`;
            if (context.datasetIndex === 3) return `建议上限: ${value} kcal`;
            return `${context.dataset.label}: ${value} kcal`;
          }
        }
      }
    },
    scales: {
      y: {
        title: {
          display: true,
          text: '热量 (kcal)'
        }
      },
      x: {
        title: {
          display: true,
          text: '日期'
        }
      }
    }
  };

  // Calculate statistics
  const weightRecords = chartData.filter(d => d.weight).length;
  const avgWeight = weightRecords > 0 
    ? chartData.filter(d => d.weight).reduce((sum, d) => sum + (d.weight || 0), 0) / weightRecords 
    : 0;
  
  const firstWeight = chartData.find(d => d.weight)?.weight;
  const lastWeight = [...chartData].reverse().find(d => d.weight)?.weight;
  const weightChange = firstWeight && lastWeight ? lastWeight - firstWeight : 0;

  const avgFoodCalories = chartData.reduce((sum, d) => sum + d.foodCalories, 0) / chartData.length;
  const avgExerciseCalories = chartData.reduce((sum, d) => sum + d.exerciseCalories, 0) / chartData.length;
  const avgNetCalories = avgFoodCalories - avgExerciseCalories;

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">体重记录天数</p>
              <p className="text-2xl font-bold text-blue-600">{weightRecords}</p>
            </div>
            <TrendingUp className="text-blue-500" size={24} />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">平均体重</p>
              <p className="text-2xl font-bold text-green-600">{avgWeight.toFixed(1)} kg</p>
            </div>
            <Scale className="text-green-500" size={24} />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">体重变化</p>
              <p className={`text-2xl font-bold ${weightChange < 0 ? 'text-green-600' : weightChange > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                {weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)} kg
              </p>
            </div>
            <BarChart3 className="text-purple-500" size={24} />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">平均净摄入</p>
              <p className="text-2xl font-bold text-orange-600">{avgNetCalories.toFixed(0)} kcal</p>
            </div>
            <BarChart3 className="text-orange-500" size={24} />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weight Trend Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <TrendingUp className="mr-2" size={20} />
            体重变化趋势
          </h3>
          <div className="h-80">
            <Chart type="line" data={weightChartData} options={weightChartOptions} />
          </div>
        </div>

        {/* Calorie Balance Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <BarChart3 className="mr-2" size={20} />
            热量收支对比
          </h3>
          <div className="h-80">
            <Chart type="bar" data={calorieChartData} options={calorieChartOptions} />
          </div>
        </div>
      </div>

      {/* Additional Insights */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">健康建议</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">体重趋势</h4>
            <p className="text-sm text-blue-700">
              {weightChange < 0 
                ? '体重呈下降趋势，继续保持良好的饮食和运动习惯！' 
                : weightChange > 0 
                ? '体重有所增加，建议适当调整饮食或增加运动量。' 
                : '体重保持稳定，继续保持当前的生活方式。'
              }
            </p>
          </div>
          
          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="font-medium text-green-800 mb-2">热量平衡</h4>
            <p className="text-sm text-green-700">
              {avgNetCalories < (userProfile?.dailyCalorieLimit || 0)
                ? '热量摄入控制良好，有助于减重目标的实现。'
                : avgNetCalories > (userProfile?.tdee || 0)
                ? '热量摄入偏高，建议适当减少或增加运动。'
                : '热量摄入适中，保持当前状态即可。'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;