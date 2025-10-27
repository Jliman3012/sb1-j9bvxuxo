import { Trade } from './supabase';

export interface TimeAnalytics {
  hourlyPerformance: { hour: number; pnl: number; trades: number; winRate: number }[];
  dailyPerformance: { day: string; pnl: number; trades: number; winRate: number }[];
  sessionPerformance: { session: string; pnl: number; trades: number; winRate: number }[];
  monthlyEquity: { month: string; equity: number }[];
  consistencyScore: number;
}

export interface RiskMetrics {
  maxDrawdown: number;
  sharpeRatio: number;
  recoveryFactor: number;
  avgRiskPerTrade: number;
  riskHealthScore: number;
  profitFactor: number;
}

export interface PsychologyMetrics {
  emotionCorrelation: { emotion: string; avgPnl: number; count: number }[];
  disciplineScore: number;
  overtradingIndex: number;
  ruleAdherence: number;
}

export interface SymbolPerformance {
  symbol: string;
  trades: number;
  winRate: number;
  avgRR: number;
  expectancy: number;
  totalPnL: number;
}

export function calculateTimeAnalytics(trades: Trade[]): TimeAnalytics {
  const completedTrades = trades.filter(t => t.exit_price && t.pnl !== null);

  const hourlyData: Record<number, { pnl: number; trades: number; wins: number }> = {};
  for (let i = 0; i < 24; i++) hourlyData[i] = { pnl: 0, trades: 0, wins: 0 };

  const dailyData: Record<string, { pnl: number; trades: number; wins: number }> = {
    'Monday': { pnl: 0, trades: 0, wins: 0 },
    'Tuesday': { pnl: 0, trades: 0, wins: 0 },
    'Wednesday': { pnl: 0, trades: 0, wins: 0 },
    'Thursday': { pnl: 0, trades: 0, wins: 0 },
    'Friday': { pnl: 0, trades: 0, wins: 0 },
    'Saturday': { pnl: 0, trades: 0, wins: 0 },
    'Sunday': { pnl: 0, trades: 0, wins: 0 },
  };

  const sessionData: Record<string, { pnl: number; trades: number; wins: number }> = {
    'Asian': { pnl: 0, trades: 0, wins: 0 },
    'London': { pnl: 0, trades: 0, wins: 0 },
    'New York': { pnl: 0, trades: 0, wins: 0 },
    'Overlap': { pnl: 0, trades: 0, wins: 0 },
  };

  completedTrades.forEach(trade => {
    const date = new Date(trade.entry_date);
    const hour = date.getHours();
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });

    hourlyData[hour].pnl += trade.pnl;
    hourlyData[hour].trades++;
    if (trade.pnl > 0) hourlyData[hour].wins++;

    dailyData[dayName].pnl += trade.pnl;
    dailyData[dayName].trades++;
    if (trade.pnl > 0) dailyData[dayName].wins++;

    const session = getSession(hour);
    sessionData[session].pnl += trade.pnl;
    sessionData[session].trades++;
    if (trade.pnl > 0) sessionData[session].wins++;
  });

  const monthlyEquity = calculateMonthlyEquity(completedTrades);
  const consistencyScore = calculateConsistencyScore(completedTrades);

  return {
    hourlyPerformance: Object.entries(hourlyData).map(([hour, data]) => ({
      hour: parseInt(hour),
      pnl: data.pnl,
      trades: data.trades,
      winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
    })),
    dailyPerformance: Object.entries(dailyData).map(([day, data]) => ({
      day,
      pnl: data.pnl,
      trades: data.trades,
      winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
    })),
    sessionPerformance: Object.entries(sessionData).map(([session, data]) => ({
      session,
      pnl: data.pnl,
      trades: data.trades,
      winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
    })),
    monthlyEquity,
    consistencyScore,
  };
}

function getSession(hour: number): string {
  if (hour >= 0 && hour < 2) return 'New York';
  if (hour >= 2 && hour < 8) return 'Asian';
  if (hour >= 8 && hour < 13) return 'London';
  if (hour >= 13 && hour < 16) return 'Overlap';
  return 'New York';
}

function calculateMonthlyEquity(trades: Trade[]): { month: string; equity: number }[] {
  const sorted = [...trades].sort((a, b) =>
    new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
  );

  const monthlyData: Record<string, number> = {};
  let runningEquity = 0;

  sorted.forEach(trade => {
    const month = new Date(trade.entry_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    runningEquity += trade.pnl;
    monthlyData[month] = runningEquity;
  });

  return Object.entries(monthlyData).map(([month, equity]) => ({ month, equity }));
}

function calculateConsistencyScore(trades: Trade[]): number {
  if (trades.length < 10) return 50;

  const winningTrades = trades.filter(t => t.pnl > 0);
  const winRate = (winningTrades.length / trades.length) * 100;

  const dailyPnL: Record<string, number> = {};
  trades.forEach(trade => {
    const date = new Date(trade.entry_date).toISOString().split('T')[0];
    if (!dailyPnL[date]) dailyPnL[date] = 0;
    dailyPnL[date] += trade.pnl;
  });

  const dailyValues = Object.values(dailyPnL);
  const positiveDays = dailyValues.filter(v => v > 0).length;
  const positiveRatio = (positiveDays / dailyValues.length) * 100;

  const avgPnL = dailyValues.reduce((sum, val) => sum + val, 0) / dailyValues.length;
  const variance = dailyValues.reduce((sum, val) => sum + Math.pow(val - avgPnL, 2), 0) / dailyValues.length;
  const stdDev = Math.sqrt(variance);
  const stabilityScore = Math.max(0, 100 - (stdDev / Math.abs(avgPnL)) * 10);

  return Math.round((winRate * 0.3 + positiveRatio * 0.4 + stabilityScore * 0.3));
}

export function calculateRiskMetrics(trades: Trade[], initialCapital: number = 10000): RiskMetrics {
  const completedTrades = trades.filter(t => t.exit_price && t.pnl !== null);

  let equity = initialCapital;
  let peak = initialCapital;
  let maxDrawdown = 0;
  const returns: number[] = [];

  completedTrades.forEach(trade => {
    equity += trade.pnl;
    if (equity > peak) peak = equity;
    const drawdown = peak - equity;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    returns.push(trade.pnl / initialCapital);
  });

  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdDev = returns.length > 1
    ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1))
    : 0;
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

  const totalPnL = completedTrades.reduce((sum, t) => sum + t.pnl, 0);
  const recoveryFactor = maxDrawdown > 0 ? totalPnL / maxDrawdown : 0;

  const avgRiskPerTrade = completedTrades.length > 0
    ? completedTrades.reduce((sum, t) => sum + Math.abs(t.entry_price * t.quantity * 0.01), 0) / completedTrades.length
    : 0;

  const winningTrades = completedTrades.filter(t => t.pnl > 0);
  const losingTrades = completedTrades.filter(t => t.pnl < 0);
  const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

  const riskHealthScore = calculateRiskHealthScore(sharpeRatio, maxDrawdown, initialCapital, profitFactor);

  return {
    maxDrawdown,
    sharpeRatio,
    recoveryFactor,
    avgRiskPerTrade,
    riskHealthScore,
    profitFactor,
  };
}

function calculateRiskHealthScore(sharpe: number, drawdown: number, capital: number, pf: number): number {
  const sharpeScore = Math.min(sharpe * 20, 40);
  const drawdownScore = Math.max(0, 30 - (drawdown / capital) * 100);
  const pfScore = Math.min(pf * 15, 30);
  return Math.round(Math.max(0, Math.min(100, sharpeScore + drawdownScore + pfScore)));
}

export function calculatePsychologyMetrics(trades: Trade[]): PsychologyMetrics {
  const emotionData: Record<string, { pnl: number; count: number }> = {};

  trades.forEach(trade => {
    if (trade.emotional_state) {
      if (!emotionData[trade.emotional_state]) {
        emotionData[trade.emotional_state] = { pnl: 0, count: 0 };
      }
      emotionData[trade.emotional_state].pnl += trade.pnl || 0;
      emotionData[trade.emotional_state].count++;
    }
  });

  const tradesWithStops = trades.filter(t => t.stop_loss).length;
  const tradesWithTargets = trades.filter(t => t.take_profit).length;
  const tradesWithNotes = trades.filter(t => t.notes && t.notes.length > 10).length;

  const disciplineScore = trades.length > 0
    ? Math.round(
        ((tradesWithStops / trades.length) * 40 +
        (tradesWithTargets / trades.length) * 30 +
        (tradesWithNotes / trades.length) * 30)
      )
    : 50;

  const avgTradesPerDay = calculateAvgTradesPerDay(trades);
  const overtradingIndex = Math.max(0, Math.min(100, (avgTradesPerDay - 3) * 20));

  return {
    emotionCorrelation: Object.entries(emotionData).map(([emotion, data]) => ({
      emotion,
      avgPnl: data.pnl / data.count,
      count: data.count,
    })),
    disciplineScore,
    overtradingIndex,
    ruleAdherence: disciplineScore,
  };
}

function calculateAvgTradesPerDay(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  const days = new Set(trades.map(t => new Date(t.entry_date).toISOString().split('T')[0]));
  return trades.length / days.size;
}

export function calculateSymbolPerformance(trades: Trade[]): SymbolPerformance[] {
  const completedTrades = trades.filter(t => t.exit_price && t.pnl !== null);
  const symbolData: Record<string, { trades: Trade[]; totalPnL: number }> = {};

  completedTrades.forEach(trade => {
    if (!symbolData[trade.symbol]) {
      symbolData[trade.symbol] = { trades: [], totalPnL: 0 };
    }
    symbolData[trade.symbol].trades.push(trade);
    symbolData[trade.symbol].totalPnL += trade.pnl;
  });

  return Object.entries(symbolData).map(([symbol, data]) => {
    const wins = data.trades.filter(t => t.pnl > 0);
    const losses = data.trades.filter(t => t.pnl < 0);

    const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length) : 1;
    const avgRR = avgLoss > 0 ? avgWin / avgLoss : 0;

    const winRate = (wins.length / data.trades.length) * 100;
    const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;

    return {
      symbol,
      trades: data.trades.length,
      winRate,
      avgRR,
      expectancy,
      totalPnL: data.totalPnL,
    };
  }).sort((a, b) => b.totalPnL - a.totalPnL);
}

export function generateAIInsights(trades: Trade[], timeAnalytics: TimeAnalytics, riskMetrics: RiskMetrics, psychMetrics: PsychologyMetrics): string[] {
  const insights: string[] = [];
  const completedTrades = trades.filter(t => t.exit_price && t.pnl !== null);

  if (completedTrades.length < 10) {
    insights.push("📊 Keep logging trades! More data will unlock personalized insights.");
    return insights;
  }

  const bestHour = timeAnalytics.hourlyPerformance
    .filter(h => h.trades >= 3)
    .sort((a, b) => b.pnl - a.pnl)[0];
  if (bestHour) {
    insights.push(`🎯 Strength: You perform best at ${bestHour.hour}:00 with $${bestHour.pnl.toFixed(2)} average. Focus on this window.`);
  }

  const worstHour = timeAnalytics.hourlyPerformance
    .filter(h => h.trades >= 3)
    .sort((a, b) => a.pnl - b.pnl)[0];
  if (worstHour && worstHour.pnl < 0) {
    insights.push(`⚠️ Weakness: Trading at ${worstHour.hour}:00 costs you $${Math.abs(worstHour.pnl).toFixed(2)}. Consider avoiding this time.`);
  }

  if (riskMetrics.sharpeRatio < 1) {
    insights.push(`📉 Your Sharpe ratio is ${riskMetrics.sharpeRatio.toFixed(2)}. Aim for 1.5+ by cutting losses faster.`);
  }

  if (psychMetrics.overtradingIndex > 60) {
    insights.push(`🚨 Overtrading detected! You average ${(psychMetrics.overtradingIndex / 20 + 3).toFixed(1)} trades/day. Quality over quantity.`);
  }

  const negativeEmotions = psychMetrics.emotionCorrelation.filter(e =>
    ['fear', 'greed', 'revenge', 'fomo', 'boredom'].includes(e.emotion.toLowerCase()) && e.avgPnl < 0
  );
  if (negativeEmotions.length > 0) {
    const worst = negativeEmotions.sort((a, b) => a.avgPnl - b.avgPnl)[0];
    insights.push(`😤 ${worst.emotion} trades cost you $${Math.abs(worst.avgPnl).toFixed(2)} on average. Journal emotions before trading.`);
  }

  if (psychMetrics.disciplineScore < 60) {
    insights.push(`📋 Discipline Score: ${psychMetrics.disciplineScore}%. Set stops and targets before every trade.`);
  }

  if (timeAnalytics.consistencyScore > 70) {
    insights.push(`✨ Great consistency! Your score is ${timeAnalytics.consistencyScore}%. Keep following your process.`);
  }

  return insights;
}
