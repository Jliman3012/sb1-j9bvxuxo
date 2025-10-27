import { useEffect, useState } from 'react';
import { supabase, UserGoals } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Target, Flame, TrendingUp, Calendar, Award, Settings, X, Check, RotateCcw } from 'lucide-react';

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  greenDaysThisWeek: number;
  greenDaysThisMonth: number;
  weekPrediction: number;
}

interface GoalProgress {
  title: string;
  currentValue: number;
  targetValue: number;
  isPercentage: boolean;
  period: string;
}

export default function GoalsTracker() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<UserGoals | null>(null);
  const [goalsProgress, setGoalsProgress] = useState<GoalProgress[]>([]);
  const [streaks, setStreaks] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    greenDaysThisWeek: 0,
    greenDaysThisMonth: 0,
    weekPrediction: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [editForm, setEditForm] = useState({
    weekly_profit_target: 1000,
    monthly_profit_target: 4000,
    daily_win_rate_target: 65,
  });
  const [errors, setErrors] = useState({
    weekly: '',
    monthly: '',
    winRate: '',
  });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      const { data: trades } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user!.id)
        .order('entry_date', { ascending: true });

      if (trades) {
        calculateStreaks(trades);
      }

      const { data: userGoals, error: goalsError } = await supabase
        .from('user_goals')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (goalsError) {
        console.error('Error loading goals:', goalsError);
      }

      if (userGoals) {
        setGoals(userGoals);
        setEditForm({
          weekly_profit_target: userGoals.weekly_profit_target,
          monthly_profit_target: userGoals.monthly_profit_target,
          daily_win_rate_target: userGoals.daily_win_rate_target,
        });
        calculateGoalsProgress(trades || [], userGoals);
      } else {
        const defaultGoals: UserGoals = {
          id: '',
          user_id: user!.id,
          weekly_profit_target: 1000,
          monthly_profit_target: 4000,
          daily_win_rate_target: 65,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setGoals(defaultGoals);
        setEditForm({
          weekly_profit_target: 1000,
          monthly_profit_target: 4000,
          daily_win_rate_target: 65,
        });
        calculateGoalsProgress(trades || [], defaultGoals);
      }
    } catch (error) {
      console.error('Error loading goals data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateGoalsProgress = (trades: any[], currentGoals: UserGoals) => {
    const progress: GoalProgress[] = [
      {
        title: 'Weekly Profit Target',
        currentValue: calculateCurrentProgress(trades, 'weekly'),
        targetValue: currentGoals.weekly_profit_target,
        isPercentage: false,
        period: 'weekly',
      },
      {
        title: 'Monthly Profit Target',
        currentValue: calculateCurrentProgress(trades, 'monthly'),
        targetValue: currentGoals.monthly_profit_target,
        isPercentage: false,
        period: 'monthly',
      },
      {
        title: 'Daily Win Rate',
        currentValue: calculateWinRate(trades, 'daily'),
        targetValue: currentGoals.daily_win_rate_target,
        isPercentage: true,
        period: 'daily',
      },
    ];
    setGoalsProgress(progress);
  };

  const validateForm = (): boolean => {
    const newErrors = { weekly: '', monthly: '', winRate: '' };
    let isValid = true;

    if (editForm.weekly_profit_target <= 0) {
      newErrors.weekly = 'Weekly target must be greater than 0';
      isValid = false;
    }

    if (editForm.monthly_profit_target <= 0) {
      newErrors.monthly = 'Monthly target must be greater than 0';
      isValid = false;
    }

    if (editForm.daily_win_rate_target < 0 || editForm.daily_win_rate_target > 100) {
      newErrors.winRate = 'Win rate must be between 0 and 100';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSaveGoals = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const goalsData = {
        user_id: user!.id,
        weekly_profit_target: editForm.weekly_profit_target,
        monthly_profit_target: editForm.monthly_profit_target,
        daily_win_rate_target: editForm.daily_win_rate_target,
      };

      if (goals?.id) {
        const { error } = await supabase
          .from('user_goals')
          .update(goalsData)
          .eq('id', goals.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_goals')
          .insert([goalsData]);

        if (error) throw error;
      }

      await loadData();
      setShowModal(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
      console.error('Error saving goals:', error);
      alert('Failed to save goals. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    setEditForm({
      weekly_profit_target: 1000,
      monthly_profit_target: 4000,
      daily_win_rate_target: 65,
    });
    setErrors({ weekly: '', monthly: '', winRate: '' });
  };

  const calculateStreaks = (trades: any[]) => {
    const completedTrades = trades.filter(t => t.exit_price && t.pnl !== null);

    const dailyPnL: Record<string, number> = {};
    completedTrades.forEach(trade => {
      const date = new Date(trade.entry_date).toISOString().split('T')[0];
      if (!dailyPnL[date]) dailyPnL[date] = 0;
      dailyPnL[date] += trade.pnl;
    });

    const sortedDates = Object.keys(dailyPnL).sort();
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    sortedDates.forEach((date, i) => {
      if (dailyPnL[date] > 0) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    });

    if (sortedDates.includes(today) || sortedDates.includes(yesterday)) {
      for (let i = sortedDates.length - 1; i >= 0; i--) {
        if (dailyPnL[sortedDates[i]] > 0) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    const greenDaysThisWeek = sortedDates.filter(
      d => d >= weekStartStr && dailyPnL[d] > 0
    ).length;

    const greenDaysThisMonth = sortedDates.filter(
      d => d >= monthStartStr && dailyPnL[d] > 0
    ).length;

    const recentPerformance = sortedDates.slice(-10);
    const recentGreenDays = recentPerformance.filter(d => dailyPnL[d] > 0).length;
    const weekPrediction = Math.round((recentGreenDays / Math.min(10, recentPerformance.length)) * 100);

    setStreaks({
      currentStreak,
      longestStreak,
      greenDaysThisWeek,
      greenDaysThisMonth,
      weekPrediction,
    });
  };

  const calculateCurrentProgress = (trades: any[], period: string): number => {
    const now = new Date();
    const completedTrades = trades.filter(t => t.exit_price && t.pnl !== null);

    let startDate: Date;
    if (period === 'daily') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'weekly') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const periodTrades = completedTrades.filter(
      t => new Date(t.entry_date) >= startDate
    );

    return periodTrades.reduce((sum, t) => sum + t.pnl, 0);
  };

  const calculateWinRate = (trades: any[], period: string): number => {
    const now = new Date();
    const completedTrades = trades.filter(t => t.exit_price && t.pnl !== null);

    let startDate: Date;
    if (period === 'daily') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'weekly') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const periodTrades = completedTrades.filter(
      t => new Date(t.entry_date) >= startDate
    );

    if (periodTrades.length === 0) return 0;
    const wins = periodTrades.filter(t => t.pnl > 0).length;
    return Math.round((wins / periodTrades.length) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Goals & Progress</h2>
        <p className="text-gray-600 dark:text-gray-400">Track your trading goals and maintain consistency</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Flame className="w-8 h-8" />
            <span className="text-3xl font-bold">{streaks.currentStreak}</span>
          </div>
          <p className="text-white/90 font-medium">Current Streak</p>
          <p className="text-white/70 text-sm mt-1">Green days in a row</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Award className="w-8 h-8" />
            <span className="text-3xl font-bold">{streaks.longestStreak}</span>
          </div>
          <p className="text-white/90 font-medium">Best Streak</p>
          <p className="text-white/70 text-sm mt-1">Personal record</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-8 h-8" />
            <span className="text-3xl font-bold">{streaks.greenDaysThisWeek}</span>
          </div>
          <p className="text-white/90 font-medium">This Week</p>
          <p className="text-white/70 text-sm mt-1">Profitable days</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8" />
            <span className="text-3xl font-bold">{streaks.weekPrediction}%</span>
          </div>
          <p className="text-white/90 font-medium">Week Forecast</p>
          <p className="text-white/70 text-sm mt-1">Success probability</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Target className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Active Goals</h3>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition font-medium"
          >
            <Settings className="w-4 h-4" />
            <span>Customize Goals</span>
          </button>
        </div>

        <div className="space-y-4">
          {goalsProgress.map((goal, i) => {
            const progress = Math.min(100, (goal.currentValue / goal.targetValue) * 100);
            const isAchieved = goal.currentValue >= goal.targetValue;

            return (
              <div key={i} className="bg-slate-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">{goal.title}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">{goal.period}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${isAchieved ? 'text-emerald-600' : 'text-gray-900 dark:text-white'}`}>
                      {goal.isPercentage ? `${goal.currentValue}%` : `$${goal.currentValue.toFixed(2)}`}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      / {goal.isPercentage ? `${goal.targetValue}%` : `$${goal.targetValue}`}
                    </p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${
                      isAchieved ? 'bg-emerald-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                {isAchieved && (
                  <p className="text-sm text-emerald-600 font-medium mt-2">Goal achieved!</p>
                )}
              </div>
            );
          })}
        </div>

        {goals?.updated_at && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
            Last updated: {new Date(goals.updated_at).toLocaleDateString()} at {new Date(goals.updated_at).toLocaleTimeString()}
          </p>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Customize Goals</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Weekly Profit Target ($)
                </label>
                <input
                  type="number"
                  value={editForm.weekly_profit_target}
                  onChange={(e) => setEditForm({ ...editForm, weekly_profit_target: parseFloat(e.target.value) || 0 })}
                  className={`w-full px-4 py-2 border ${errors.weekly ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                  placeholder="1000"
                  min="0"
                  step="100"
                />
                {errors.weekly && <p className="text-red-500 text-xs mt-1">{errors.weekly}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Monthly Profit Target ($)
                </label>
                <input
                  type="number"
                  value={editForm.monthly_profit_target}
                  onChange={(e) => setEditForm({ ...editForm, monthly_profit_target: parseFloat(e.target.value) || 0 })}
                  className={`w-full px-4 py-2 border ${errors.monthly ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                  placeholder="4000"
                  min="0"
                  step="100"
                />
                {errors.monthly && <p className="text-red-500 text-xs mt-1">{errors.monthly}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Daily Win Rate Target (%)
                </label>
                <input
                  type="number"
                  value={editForm.daily_win_rate_target}
                  onChange={(e) => setEditForm({ ...editForm, daily_win_rate_target: parseFloat(e.target.value) || 0 })}
                  className={`w-full px-4 py-2 border ${errors.winRate ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                  placeholder="65"
                  min="0"
                  max="100"
                  step="5"
                />
                {errors.winRate && <p className="text-red-500 text-xs mt-1">{errors.winRate}</p>}
              </div>
            </div>

            <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleResetToDefaults}
                className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="text-sm">Reset to Defaults</span>
              </button>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveGoals}
                  disabled={saving}
                  className="flex items-center space-x-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save Goals'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showToast && (
        <div className="fixed bottom-6 right-6 bg-emerald-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2 z-50 animate-slide-up">
          <Check className="w-5 h-5" />
          <span className="font-medium">Goals saved successfully!</span>
        </div>
      )}
    </div>
  );
}
