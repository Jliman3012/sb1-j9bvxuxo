import { supabase } from './supabase';

export interface ProgressMetrics {
  totalXP: number;
  currentStreak: number;
  longestStreak: number;
  disciplineScore: number;
  consistencyScore: number;
  level: number;
  badges: any[];
  achievements: any[];
}

export async function calculateProgressMetrics(userId: string): Promise<ProgressMetrics> {
  try {
    const { data: trades } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .order('entry_date', { ascending: true });

    if (!trades || trades.length === 0) {
      return {
        totalXP: 0,
        currentStreak: 0,
        longestStreak: 0,
        disciplineScore: 50,
        consistencyScore: 50,
        level: 1,
        badges: [],
        achievements: [],
      };
    }

    let xp = 0;
    xp += trades.length * 10;

    const tradesWithNotes = trades.filter(t => t.notes && t.notes.length > 10);
    xp += tradesWithNotes.length * 5;

    const completedTrades = trades.filter(t => t.exit_price && t.pnl !== null);
    const winningTrades = completedTrades.filter(t => t.pnl > 0);

    const profitableDays = calculateProfitableDays(completedTrades);
    xp += profitableDays * 25;

    const { currentStreak, longestStreak } = calculateStreaks(completedTrades);
    xp += currentStreak * 15;

    const disciplineScore = calculateDisciplineScore(trades);
    const consistencyScore = calculateConsistencyScore(completedTrades);

    const level = Math.floor(xp / 1000) + 1;

    const badges = calculateBadges(trades, completedTrades, winningTrades, currentStreak, longestStreak);
    const achievements = calculateAchievements(trades, completedTrades);

    return {
      totalXP: xp,
      currentStreak,
      longestStreak,
      disciplineScore,
      consistencyScore,
      level,
      badges,
      achievements,
    };
  } catch (error) {
    console.error('Error calculating progress metrics:', error);
    throw error;
  }
}

function calculateStreaks(trades: any[]): { currentStreak: number; longestStreak: number } {
  if (trades.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const tradeDates = trades
    .map(t => new Date(t.entry_date).toISOString().split('T')[0])
    .filter((date, index, self) => self.indexOf(date) === index)
    .sort();

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 1;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (tradeDates.includes(today) || tradeDates.includes(yesterday)) {
    currentStreak = 1;

    for (let i = tradeDates.length - 2; i >= 0; i--) {
      const current = new Date(tradeDates[i + 1]);
      const prev = new Date(tradeDates[i]);
      const diffDays = Math.floor((current.getTime() - prev.getTime()) / 86400000);

      if (diffDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  for (let i = 1; i < tradeDates.length; i++) {
    const current = new Date(tradeDates[i]);
    const prev = new Date(tradeDates[i - 1]);
    const diffDays = Math.floor((current.getTime() - prev.getTime()) / 86400000);

    if (diffDays === 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }

  longestStreak = Math.max(longestStreak, tempStreak);
  longestStreak = Math.max(longestStreak, currentStreak);

  return { currentStreak, longestStreak };
}

function calculateProfitableDays(trades: any[]): number {
  const dayPnL: Record<string, number> = {};

  trades.forEach(trade => {
    const date = new Date(trade.entry_date).toISOString().split('T')[0];
    if (!dayPnL[date]) dayPnL[date] = 0;
    dayPnL[date] += trade.pnl || 0;
  });

  return Object.values(dayPnL).filter(pnl => pnl > 0).length;
}

function calculateDisciplineScore(trades: any[]): number {
  if (trades.length === 0) return 50;

  let score = 50;

  const tradesWithStops = trades.filter(t => t.stop_loss).length;
  score += (tradesWithStops / trades.length) * 20;

  const tradesWithTargets = trades.filter(t => t.take_profit).length;
  score += (tradesWithTargets / trades.length) * 15;

  const tradesWithNotes = trades.filter(t => t.notes && t.notes.length > 10).length;
  score += (tradesWithNotes / trades.length) * 15;

  return Math.min(100, Math.round(score));
}

function calculateConsistencyScore(trades: any[]): number {
  if (trades.length < 5) return 50;

  const winningTrades = trades.filter(t => t.pnl > 0);
  const winRate = (winningTrades.length / trades.length) * 100;

  let score = winRate * 0.4;

  const tradeDates = trades
    .map(t => new Date(t.entry_date).toISOString().split('T')[0])
    .filter((date, index, self) => self.indexOf(date) === index);

  const daysSinceFirst = Math.floor(
    (new Date().getTime() - new Date(trades[0].entry_date).getTime()) / 86400000
  );

  const avgTradesPerDay = daysSinceFirst > 0 ? trades.length / daysSinceFirst : 0;
  const frequencyScore = Math.min(avgTradesPerDay * 50, 30);
  score += frequencyScore;

  const pnls = trades.map(t => t.pnl || 0);
  const avgPnL = pnls.reduce((sum, pnl) => sum + pnl, 0) / pnls.length;
  const variance = pnls.reduce((sum, pnl) => sum + Math.pow(pnl - avgPnL, 2), 0) / pnls.length;
  const stdDev = Math.sqrt(variance);
  const consistencyFactor = Math.max(0, 30 - stdDev / 10);
  score += consistencyFactor;

  return Math.min(100, Math.round(score));
}

function calculateBadges(
  allTrades: any[],
  completedTrades: any[],
  winningTrades: any[],
  currentStreak: number,
  longestStreak: number
): any[] {
  const badges = [];

  if (allTrades.length >= 1) {
    badges.push({ id: 'first_trade', earned_at: allTrades[0].created_at });
  }

  if (currentStreak >= 5 || longestStreak >= 5) {
    badges.push({ id: 'week_warrior', earned_at: new Date().toISOString() });
  }

  if (completedTrades.length >= 20) {
    const last20 = completedTrades.slice(-20);
    const wins = last20.filter(t => t.pnl > 0).length;
    if ((wins / 20) >= 0.7) {
      badges.push({ id: 'profit_master', earned_at: new Date().toISOString() });
    }
  }

  if (allTrades.length >= 100) {
    badges.push({ id: 'century', earned_at: new Date().toISOString() });
  }

  return badges;
}

function calculateAchievements(allTrades: any[], completedTrades: any[]): any[] {
  const achievements = [];

  if (allTrades.length >= 10) {
    achievements.push({
      name: 'Getting Started',
      description: 'Logged 10 trades',
      unlocked: true,
    });
  }

  if (completedTrades.length >= 50) {
    achievements.push({
      name: 'Experienced Trader',
      description: 'Completed 50 trades',
      unlocked: true,
    });
  }

  return achievements;
}
