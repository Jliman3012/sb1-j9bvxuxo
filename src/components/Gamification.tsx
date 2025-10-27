import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Trophy, Target, Flame, Award, TrendingUp, Star, Zap, RefreshCw } from 'lucide-react';
import { calculateProgressMetrics } from '../lib/progressCalculator';

interface GamificationData {
  id: string;
  current_level: number;
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  badges: any[];
  achievements: any[];
  discipline_score: number;
  consistency_score: number;
}

export default function Gamification() {
  const { user } = useAuth();
  const [gamData, setGamData] = useState<GamificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (user) {
      loadGamificationData();
    }
  }, [user]);

  const loadGamificationData = async () => {
    try {
      console.log('Loading gamification data for user:', user!.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user!.id)
        .maybeSingle();

      if (!profile) {
        console.error('Profile not found');
        setLoading(false);
        return;
      }

      const metrics = await calculateProgressMetrics(user!.id);
      console.log('Calculated metrics:', metrics);

      const { data, error } = await supabase
        .from('gamification')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching gamification:', error);
        throw error;
      }

      if (!data) {
        const { data: newData, error: insertError } = await supabase
          .from('gamification')
          .insert({
            user_id: user!.id,
            current_level: metrics.level,
            total_xp: metrics.totalXP,
            current_streak: metrics.currentStreak,
            longest_streak: metrics.longestStreak,
            badges: metrics.badges,
            achievements: metrics.achievements,
            discipline_score: metrics.disciplineScore,
            consistency_score: metrics.consistencyScore,
          })
          .select()
          .maybeSingle();

        if (insertError) {
          console.error('Error inserting gamification:', insertError);
          throw insertError;
        }
        console.log('Created new gamification record:', newData);
        setGamData(newData);
      } else {
        const { error: updateError } = await supabase
          .from('gamification')
          .update({
            current_level: metrics.level,
            total_xp: metrics.totalXP,
            current_streak: metrics.currentStreak,
            longest_streak: metrics.longestStreak,
            badges: metrics.badges,
            achievements: metrics.achievements,
            discipline_score: metrics.disciplineScore,
            consistency_score: metrics.consistencyScore,
          })
          .eq('user_id', user!.id);

        if (updateError) {
          console.error('Error updating gamification:', updateError);
        }

        setGamData({
          ...data,
          current_level: metrics.level,
          total_xp: metrics.totalXP,
          current_streak: metrics.currentStreak,
          longest_streak: metrics.longestStreak,
          badges: metrics.badges,
          achievements: metrics.achievements,
          discipline_score: metrics.disciplineScore,
          consistency_score: metrics.consistencyScore,
        });
        console.log('Updated gamification data');
      }
    } catch (error) {
      console.error('Error loading gamification:', error);
      alert('Failed to load progress data. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const refreshProgress = async () => {
    setUpdating(true);
    try {
      await loadGamificationData();
    } finally {
      setUpdating(false);
    }
  };

  const calculateNextLevelXP = (level: number) => {
    return level * 1000;
  };

  const getProgressPercentage = () => {
    if (!gamData) return 0;
    const nextLevelXP = calculateNextLevelXP(gamData.current_level);
    const currentLevelXP = calculateNextLevelXP(gamData.current_level - 1);
    const xpInCurrentLevel = gamData.total_xp - currentLevelXP;
    const xpNeededForLevel = nextLevelXP - currentLevelXP;
    return Math.min((xpInCurrentLevel / xpNeededForLevel) * 100, 100);
  };

  const availableBadges = [
    { id: 'first_trade', name: 'First Trade', icon: '🎯', description: 'Log your first trade' },
    { id: 'week_warrior', name: 'Week Warrior', icon: '📅', description: 'Trade 5 consecutive days' },
    { id: 'profit_master', name: 'Profit Master', icon: '💰', description: 'Achieve 70% win rate over 20 trades' },
    { id: 'disciplined', name: 'Disciplined Trader', icon: '🎖️', description: 'Follow your rules for 14 days straight' },
    { id: 'risk_manager', name: 'Risk Manager', icon: '🛡️', description: 'Never risk more than 2% per trade for a month' },
    { id: 'century', name: 'Century Club', icon: '💯', description: 'Log 100 trades' },
    { id: 'comeback_kid', name: 'Comeback Kid', icon: '🔥', description: 'Turn 5 loss streak into 5 win streak' },
    { id: 'early_bird', name: 'Early Bird', icon: '🌅', description: 'Trade profitably before 10 AM for 10 days' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!gamData) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between w-full">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Your Progress</h1>
          <p className="text-gray-600 mt-1">Level up by trading consistently and following your plan</p>
        </div>
        <button
          onClick={refreshProgress}
          disabled={updating}
          className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition font-medium disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${updating ? 'animate-spin' : ''}`} />
          <span>{updating ? 'Updating...' : 'Refresh'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <Star className="w-8 h-8" />
            <span className="text-3xl font-bold">{gamData.current_level}</span>
          </div>
          <p className="text-sm font-medium opacity-90">Current Level</p>
          <div className="mt-4 bg-white/20 rounded-full h-2 overflow-hidden">
            <div
              className="bg-white h-full transition-all duration-500"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
          <p className="text-xs mt-2 opacity-75">
            {gamData.total_xp} / {calculateNextLevelXP(gamData.current_level)} XP
          </p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <Flame className="w-8 h-8" />
            <span className="text-3xl font-bold">{gamData.current_streak}</span>
          </div>
          <p className="text-sm font-medium opacity-90">Current Streak</p>
          <p className="text-xs mt-4 opacity-75">
            Best: {gamData.longest_streak} days
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <Target className="w-8 h-8" />
            <span className="text-3xl font-bold">{gamData.discipline_score}</span>
          </div>
          <p className="text-sm font-medium opacity-90">Discipline Score</p>
          <div className="mt-4 bg-white/20 rounded-full h-2 overflow-hidden">
            <div
              className="bg-white h-full transition-all"
              style={{ width: `${gamData.discipline_score}%` }}
            />
          </div>
        </div>

        <div className="bg-gradient-to-br from-violet-500 to-purple-500 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-8 h-8" />
            <span className="text-3xl font-bold">{gamData.consistency_score}</span>
          </div>
          <p className="text-sm font-medium opacity-90">Consistency Score</p>
          <div className="mt-4 bg-white/20 rounded-full h-2 overflow-hidden">
            <div
              className="bg-white h-full transition-all"
              style={{ width: `${gamData.consistency_score}%` }}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Trophy className="w-6 h-6 text-yellow-500" />
          <h2 className="text-xl font-bold text-gray-900">Badges & Achievements</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {availableBadges.map((badge) => {
            const earned = gamData.badges?.some((b: any) => b.id === badge.id);
            return (
              <div
                key={badge.id}
                className={`border-2 rounded-lg p-4 text-center transition ${
                  earned
                    ? 'border-yellow-400 bg-yellow-50'
                    : 'border-gray-200 bg-gray-50 opacity-50'
                }`}
              >
                <div className="text-4xl mb-2">{badge.icon}</div>
                <p className="font-semibold text-sm text-gray-900 mb-1">{badge.name}</p>
                <p className="text-xs text-gray-600">{badge.description}</p>
                {earned && (
                  <div className="mt-2 flex items-center justify-center">
                    <Award className="w-4 h-4 text-yellow-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Zap className="w-6 h-6 text-emerald-500" />
          <h2 className="text-xl font-bold text-gray-900">How to Earn XP</h2>
        </div>

        <div className="grid gap-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-700">Log a trade</span>
            <span className="font-bold text-emerald-600">+10 XP</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-700">Add trade notes and tags</span>
            <span className="font-bold text-emerald-600">+5 XP</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-700">Follow trading rules</span>
            <span className="font-bold text-emerald-600">+20 XP</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-700">Maintain daily streak</span>
            <span className="font-bold text-emerald-600">+15 XP</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-700">Achieve positive P&L day</span>
            <span className="font-bold text-emerald-600">+25 XP</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-700">Complete weekly review</span>
            <span className="font-bold text-emerald-600">+50 XP</span>
          </div>
        </div>
      </div>
    </div>
  );
}
