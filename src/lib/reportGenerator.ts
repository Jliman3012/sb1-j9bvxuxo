import { Trade } from './supabase';

export interface WeeklyReport {
  period: string;
  totalTrades: number;
  winRate: number;
  totalPnL: number;
  bestDay: { date: string; pnl: number };
  worstDay: { date: string; pnl: number };
  bestTrade: { symbol: string; pnl: number };
  worstTrade: { symbol: string; pnl: number };
  topSymbol: { symbol: string; pnl: number };
  avgHoldTime: number;
  profitFactor: number;
  consistency: string;
  insights: string[];
}

export function generateWeeklyReport(trades: Trade[]): WeeklyReport {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);

  const weekTrades = trades.filter(
    t => new Date(t.entry_date) >= weekStart && t.exit_price && t.pnl !== null
  );

  if (weekTrades.length === 0) {
    return {
      period: `${weekStart.toLocaleDateString()} - ${now.toLocaleDateString()}`,
      totalTrades: 0,
      winRate: 0,
      totalPnL: 0,
      bestDay: { date: '-', pnl: 0 },
      worstDay: { date: '-', pnl: 0 },
      bestTrade: { symbol: '-', pnl: 0 },
      worstTrade: { symbol: '-', pnl: 0 },
      topSymbol: { symbol: '-', pnl: 0 },
      avgHoldTime: 0,
      profitFactor: 0,
      consistency: 'N/A',
      insights: ['Not enough data for this week.'],
    };
  }

  const winningTrades = weekTrades.filter(t => t.pnl > 0);
  const losingTrades = weekTrades.filter(t => t.pnl < 0);
  const totalPnL = weekTrades.reduce((sum, t) => sum + t.pnl, 0);
  const winRate = (winningTrades.length / weekTrades.length) * 100;

  const dailyPnL: Record<string, number> = {};
  weekTrades.forEach(trade => {
    const date = new Date(trade.entry_date).toISOString().split('T')[0];
    if (!dailyPnL[date]) dailyPnL[date] = 0;
    dailyPnL[date] += trade.pnl;
  });

  const sortedDays = Object.entries(dailyPnL).sort((a, b) => b[1] - a[1]);
  const bestDay = sortedDays[0] ? { date: sortedDays[0][0], pnl: sortedDays[0][1] } : { date: '-', pnl: 0 };
  const worstDay = sortedDays[sortedDays.length - 1]
    ? { date: sortedDays[sortedDays.length - 1][0], pnl: sortedDays[sortedDays.length - 1][1] }
    : { date: '-', pnl: 0 };

  const sortedTrades = [...weekTrades].sort((a, b) => b.pnl - a.pnl);
  const bestTrade = { symbol: sortedTrades[0]?.symbol || '-', pnl: sortedTrades[0]?.pnl || 0 };
  const worstTrade = {
    symbol: sortedTrades[sortedTrades.length - 1]?.symbol || '-',
    pnl: sortedTrades[sortedTrades.length - 1]?.pnl || 0,
  };

  const symbolPnL: Record<string, number> = {};
  weekTrades.forEach(trade => {
    if (!symbolPnL[trade.symbol]) symbolPnL[trade.symbol] = 0;
    symbolPnL[trade.symbol] += trade.pnl;
  });
  const topSymbolEntry = Object.entries(symbolPnL).sort((a, b) => b[1] - a[1])[0];
  const topSymbol = topSymbolEntry ? { symbol: topSymbolEntry[0], pnl: topSymbolEntry[1] } : { symbol: '-', pnl: 0 };

  const avgHoldTime = weekTrades
    .filter(t => t.exit_date)
    .reduce((sum, t) => {
      const entry = new Date(t.entry_date).getTime();
      const exit = new Date(t.exit_date!).getTime();
      return sum + (exit - entry) / (1000 * 60 * 60);
    }, 0) / weekTrades.filter(t => t.exit_date).length;

  const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

  const positiveDays = Object.values(dailyPnL).filter(v => v > 0).length;
  const totalDays = Object.keys(dailyPnL).length;
  const consistency = totalDays > 0 ? `${Math.round((positiveDays / totalDays) * 100)}%` : 'N/A';

  const insights = generateWeeklyInsights(weekTrades, winRate, totalPnL, profitFactor);

  return {
    period: `${weekStart.toLocaleDateString()} - ${now.toLocaleDateString()}`,
    totalTrades: weekTrades.length,
    winRate,
    totalPnL,
    bestDay,
    worstDay,
    bestTrade,
    worstTrade,
    topSymbol,
    avgHoldTime,
    profitFactor,
    consistency,
    insights,
  };
}

function generateWeeklyInsights(trades: Trade[], winRate: number, totalPnL: number, pf: number): string[] {
  const insights: string[] = [];

  if (totalPnL > 0) {
    insights.push(`✅ Positive week with $${totalPnL.toFixed(2)} profit!`);
  } else {
    insights.push(`⚠️ Negative week: $${totalPnL.toFixed(2)}. Review and adjust.`);
  }

  if (winRate >= 70) {
    insights.push(`🎯 Excellent win rate at ${winRate.toFixed(1)}%!`);
  } else if (winRate < 50) {
    insights.push(`📉 Win rate at ${winRate.toFixed(1)}% needs improvement.`);
  }

  if (pf >= 2) {
    insights.push(`💪 Strong profit factor of ${pf.toFixed(2)}.`);
  } else if (pf < 1) {
    insights.push(`⚠️ Profit factor ${pf.toFixed(2)} indicates losses exceed wins.`);
  }

  const avgTradesPerDay = trades.length / 7;
  if (avgTradesPerDay > 10) {
    insights.push(`⚠️ High trade frequency: ${avgTradesPerDay.toFixed(1)} trades/day. Consider quality over quantity.`);
  }

  return insights;
}

export function exportReportAsText(report: WeeklyReport): string {
  return `
WEEKLY TRADING REPORT
${report.period}

OVERVIEW
--------
Total Trades: ${report.totalTrades}
Win Rate: ${report.winRate.toFixed(1)}%
Total P&L: $${report.totalPnL.toFixed(2)}
Profit Factor: ${report.profitFactor.toFixed(2)}
Consistency: ${report.consistency}

HIGHLIGHTS
----------
Best Day: ${report.bestDay.date} ($${report.bestDay.pnl.toFixed(2)})
Worst Day: ${report.worstDay.date} ($${report.worstDay.pnl.toFixed(2)})
Best Trade: ${report.bestTrade.symbol} ($${report.bestTrade.pnl.toFixed(2)})
Worst Trade: ${report.worstTrade.symbol} ($${report.worstTrade.pnl.toFixed(2)})
Top Symbol: ${report.topSymbol.symbol} ($${report.topSymbol.pnl.toFixed(2)})
Avg Hold Time: ${report.avgHoldTime.toFixed(1)} hours

INSIGHTS
--------
${report.insights.join('\n')}

---
Generated by TradeJournal Pro
`.trim();
}
