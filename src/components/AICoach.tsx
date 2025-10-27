import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Brain, TrendingUp, AlertTriangle, Lightbulb, Target, Clock } from 'lucide-react';

interface Insight {
  id: string;
  insight_type: string;
  title: string;
  content: string;
  data: any;
  priority: string;
  is_read: boolean;
  created_at: string;
}

export default function AICoach() {
  const { user } = useAuth();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadInsights();
    }
  }, [user]);

  const loadInsights = async () => {
    try {
      console.log('Loading AI insights for user:', user!.id);
      const { data, error } = await supabase
        .from('ai_insights')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Supabase error loading insights:', error);
        throw error;
      }
      console.log('Loaded insights:', data?.length || 0);
      setInsights(data || []);
      setError(null);
    } catch (error) {
      console.error('Error loading insights:', error);
      setError('Failed to load insights. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateInsights = async () => {
    setGenerating(true);
    setError(null);
    try {
      console.log('Fetching trades for analysis...');
      const { data: trades, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user!.id)
        .order('entry_date', { ascending: false })
        .limit(100);

      if (tradesError) {
        console.error('Error fetching trades:', tradesError);
        throw tradesError;
      }

      if (!trades || trades.length === 0) {
        setError('Not enough trading data to generate insights. Add some trades first!');
        return;
      }

      console.log('Analyzing', trades.length, 'trades...');
      const newInsights = await analyzeTrading(trades);
      console.log('Generated', newInsights.length, 'insights');

      if (newInsights.length === 0) {
        setError('No new insights generated. Try adding more completed trades.');
        return;
      }

      for (const insight of newInsights) {
        const { error: insertError } = await supabase.from('ai_insights').insert({
          user_id: user!.id,
          ...insight,
        });

        if (insertError) {
          console.error('Error inserting insight:', insertError);
        }
      }

      await loadInsights();
      console.log('Insights generated successfully');
    } catch (error) {
      console.error('Error generating insights:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate insights. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const analyzeTrading = async (trades: any[]): Promise<any[]> => {
    const insights = [];

    const completedTrades = trades.filter(t => t.exit_price && t.pnl !== null);
    if (completedTrades.length === 0) {
      return [{
        insight_type: 'recommendation',
        title: 'Start Trading',
        content: 'Complete some trades to unlock AI insights and pattern detection.',
        data: {},
        priority: 'normal',
        is_read: false,
      }];
    }

    const winningTrades = completedTrades.filter(t => t.pnl > 0);
    const losingTrades = completedTrades.filter(t => t.pnl < 0);
    const winRate = completedTrades.length > 0 ? (winningTrades.length / completedTrades.length) * 100 : 0;

    const today = new Date();
    const recentTrades = completedTrades.filter(t => {
      const tradeDate = new Date(t.entry_date);
      const daysDiff = (today.getTime() - tradeDate.getTime()) / (1000 * 3600 * 24);
      return daysDiff <= 7;
    });

    const totalPnL = completedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const recentPnL = recentTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

    insights.push({
      insight_type: 'daily_summary',
      title: 'Weekly Performance Summary',
      content: `This week you took ${recentTrades.length} trades with a ${winRate.toFixed(1)}% win rate and ${recentPnL >= 0 ? '+' : ''}$${recentPnL.toFixed(2)} P&L. ${
        winRate > 50 && recentPnL > 0
          ? 'Excellent work! You\'re trading with discipline.'
          : winRate > 50
          ? 'Good win rate, but watch your position sizing to improve profitability.'
          : recentPnL > 0
          ? 'Profitable week! Focus on improving consistency.'
          : 'Consider reviewing your strategy and risk management.'
      }`,
      data: { trades: recentTrades.length, winRate, pnl: recentPnL },
      priority: 'normal',
      is_read: false,
    });

    const lossStreak = detectLossStreak(trades);
    if (lossStreak >= 3) {
      insights.push({
        insight_type: 'warning',
        title: 'Loss Streak Detected',
        content: `You've had ${lossStreak} consecutive losing trades. Consider taking a break to reset your mindset and review your strategy.`,
        data: { streak: lossStreak },
        priority: 'urgent',
        is_read: false,
      });
    }

    const timeAnalysis = analyzeTimePatterns(trades);
    if (timeAnalysis.bestTime) {
      insights.push({
        insight_type: 'pattern_detected',
        title: 'Optimal Trading Time Found',
        content: `Your best trades happen around ${timeAnalysis.bestTime}. Consider focusing your trading during this window.`,
        data: timeAnalysis,
        priority: 'high',
        is_read: false,
      });
    }

    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length
      : 0;
    const avgLoss = losingTrades.length > 0
      ? Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / losingTrades.length)
      : 0;
    const profitFactor = avgLoss > 0 ? (avgWin * winningTrades.length) / (avgLoss * losingTrades.length) : 0;

    if (avgLoss > avgWin * 1.5) {
      insights.push({
        insight_type: 'recommendation',
        title: 'Risk-Reward Ratio Needs Improvement',
        content: `Your average loss ($${avgLoss.toFixed(2)}) is significantly larger than your average win ($${avgWin.toFixed(2)}). This creates a ${(avgLoss/avgWin).toFixed(1)}:1 loss-to-win ratio. Target a minimum 1:2 risk-reward ratio by either tightening stop losses or letting winners run longer to profit targets.`,
        data: { avgWin, avgLoss, ratio: avgLoss/avgWin },
        priority: 'high',
        is_read: false,
      });
    } else if (profitFactor > 1.5) {
      insights.push({
        insight_type: 'milestone',
        title: 'Excellent Risk Management',
        content: `Your profit factor is ${profitFactor.toFixed(2)}, indicating strong risk-reward management. Average win: $${avgWin.toFixed(2)}, Average loss: $${avgLoss.toFixed(2)}. Keep up this disciplined approach!`,
        data: { avgWin, avgLoss, profitFactor },
        priority: 'normal',
        is_read: false,
      });
    }

    const symbolAnalysis = analyzeSymbolPerformance(completedTrades);
    if (symbolAnalysis.bestSymbol) {
      insights.push({
        insight_type: 'pattern_detected',
        title: `Strong Performance on ${symbolAnalysis.bestSymbol}`,
        content: `You have a ${symbolAnalysis.winRate.toFixed(1)}% win rate on ${symbolAnalysis.bestSymbol} with an average P&L of $${symbolAnalysis.avgPnL.toFixed(2)} over ${symbolAnalysis.count} trades. Consider focusing more on this symbol where you show consistent edge.`,
        data: symbolAnalysis,
        priority: 'high',
        is_read: false,
      });
    }
    if (symbolAnalysis.worstSymbol && symbolAnalysis.worstCount >= 5) {
      insights.push({
        insight_type: 'warning',
        title: `Struggling with ${symbolAnalysis.worstSymbol}`,
        content: `Your win rate on ${symbolAnalysis.worstSymbol} is ${symbolAnalysis.worstWinRate.toFixed(1)}% with average loss of $${Math.abs(symbolAnalysis.worstAvgPnL).toFixed(2)}. Consider avoiding this symbol or adjusting your strategy specifically for it.`,
        data: { symbol: symbolAnalysis.worstSymbol, winRate: symbolAnalysis.worstWinRate, avgPnL: symbolAnalysis.worstAvgPnL },
        priority: 'high',
        is_read: false,
      });
    }

    const holdTimeAnalysis = analyzeHoldTime(completedTrades);
    if (holdTimeAnalysis.optimalRange) {
      insights.push({
        insight_type: 'pattern_detected',
        title: 'Optimal Hold Time Identified',
        content: `Your most profitable trades are held for ${holdTimeAnalysis.optimalRange} with an average P&L of $${holdTimeAnalysis.avgPnL.toFixed(2)}. Trades held ${holdTimeAnalysis.comparison} tend to be less profitable. Consider exiting positions within this optimal timeframe.`,
        data: holdTimeAnalysis,
        priority: 'high',
        is_read: false,
      });
    }

    const weekdayAnalysis = analyzeWeekdayPerformance(completedTrades);
    if (weekdayAnalysis.bestDay) {
      insights.push({
        insight_type: 'pattern_detected',
        title: `${weekdayAnalysis.bestDay} is Your Best Trading Day`,
        content: `You have a ${weekdayAnalysis.winRate.toFixed(1)}% win rate on ${weekdayAnalysis.bestDay}s with average P&L of $${weekdayAnalysis.avgPnL.toFixed(2)}. Consider increasing position sizes or trade frequency on this day.`,
        data: weekdayAnalysis,
        priority: 'normal',
        is_read: false,
      });
    }

    const emotionalAnalysis = analyzeEmotionalPatterns(completedTrades);
    if (emotionalAnalysis.insight) {
      insights.push({
        insight_type: 'recommendation',
        title: 'Emotional Pattern Detected',
        content: emotionalAnalysis.insight,
        data: emotionalAnalysis.data,
        priority: 'high',
        is_read: false,
      });
    }

    if (totalPnL < 0 && completedTrades.length >= 20) {
      insights.push({
        insight_type: 'warning',
        title: 'Negative Overall Performance',
        content: `Your total P&L is $${totalPnL.toFixed(2)} across ${completedTrades.length} trades. This suggests systematic issues with your strategy. Consider: 1) Reducing position size while you refine your approach, 2) Paper trading new setups before risking capital, 3) Reviewing your entry/exit rules with fresh eyes.`,
        data: { totalPnL, tradeCount: completedTrades.length },
        priority: 'urgent',
        is_read: false,
      });
    }

    if (completedTrades.length >= 100) {
      insights.push({
        insight_type: 'milestone',
        title: 'Century Milestone Achieved!',
        content: `Congratulations! You've completed ${completedTrades.length} trades with a total P&L of $${totalPnL.toFixed(2)}. You now have enough data for statistically significant analysis. This consistency in tracking shows professional-level discipline.`,
        data: { totalTrades: completedTrades.length, totalPnL },
        priority: 'normal',
        is_read: false,
      });
    } else if (completedTrades.length >= 50) {
      insights.push({
        insight_type: 'milestone',
        title: 'Halfway to 100 Trades',
        content: `You've logged ${completedTrades.length} trades. Keep going - at 100 trades, you'll have enough data for robust statistical analysis of your edge.`,
        data: { totalTrades: completedTrades.length },
        priority: 'normal',
        is_read: false,
      });
    }

    return insights;
  };

  const detectLossStreak = (trades: any[]): number => {
    let streak = 0;
    for (const trade of trades) {
      if (trade.pnl < 0) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };

  const analyzeTimePatterns = (trades: any[]): any => {
    const hourlyPerformance: Record<number, { pnl: number; count: number }> = {};

    trades.forEach(trade => {
      if (trade.pnl === null) return;
      const hour = new Date(trade.entry_date).getHours();
      if (!hourlyPerformance[hour]) {
        hourlyPerformance[hour] = { pnl: 0, count: 0 };
      }
      hourlyPerformance[hour].pnl += trade.pnl || 0;
      hourlyPerformance[hour].count += 1;
    });

    let bestHour = -1;
    let bestAvgPnl = -Infinity;

    Object.entries(hourlyPerformance).forEach(([hour, data]) => {
      const avgPnl = data.pnl / data.count;
      if (avgPnl > bestAvgPnl && data.count >= 5) {
        bestAvgPnl = avgPnl;
        bestHour = parseInt(hour);
      }
    });

    return bestHour >= 0 ? { bestTime: `${bestHour}:00 - ${bestHour + 1}:00`, avgPnl: bestAvgPnl } : {};
  };

  const analyzeSymbolPerformance = (trades: any[]): any => {
    const symbolStats: Record<string, { wins: number; total: number; pnl: number }> = {};

    trades.forEach(trade => {
      const symbol = trade.symbol;
      if (!symbolStats[symbol]) {
        symbolStats[symbol] = { wins: 0, total: 0, pnl: 0 };
      }
      symbolStats[symbol].total += 1;
      if (trade.pnl > 0) symbolStats[symbol].wins += 1;
      symbolStats[symbol].pnl += trade.pnl || 0;
    });

    let bestSymbol = null;
    let bestScore = -Infinity;
    let worstSymbol = null;
    let worstScore = Infinity;

    Object.entries(symbolStats).forEach(([symbol, stats]) => {
      if (stats.total < 5) return;
      const winRate = (stats.wins / stats.total) * 100;
      const avgPnL = stats.pnl / stats.total;
      const score = winRate * 0.5 + avgPnL;

      if (score > bestScore && winRate > 55) {
        bestScore = score;
        bestSymbol = symbol;
      }
      if (score < worstScore) {
        worstScore = score;
        worstSymbol = symbol;
      }
    });

    return {
      bestSymbol,
      winRate: bestSymbol ? (symbolStats[bestSymbol].wins / symbolStats[bestSymbol].total) * 100 : 0,
      avgPnL: bestSymbol ? symbolStats[bestSymbol].pnl / symbolStats[bestSymbol].total : 0,
      count: bestSymbol ? symbolStats[bestSymbol].total : 0,
      worstSymbol,
      worstWinRate: worstSymbol ? (symbolStats[worstSymbol].wins / symbolStats[worstSymbol].total) * 100 : 0,
      worstAvgPnL: worstSymbol ? symbolStats[worstSymbol].pnl / symbolStats[worstSymbol].total : 0,
      worstCount: worstSymbol ? symbolStats[worstSymbol].total : 0,
    };
  };

  const analyzeHoldTime = (trades: any[]): any => {
    const tradesWithHoldTime = trades.filter(t => t.exit_date).map(t => ({
      ...t,
      holdMinutes: (new Date(t.exit_date).getTime() - new Date(t.entry_date).getTime()) / 60000,
    }));

    if (tradesWithHoldTime.length < 10) return {};

    const ranges = [
      { name: 'under 30 minutes', min: 0, max: 30 },
      { name: '30 minutes to 2 hours', min: 30, max: 120 },
      { name: '2 to 6 hours', min: 120, max: 360 },
      { name: 'over 6 hours', min: 360, max: Infinity },
    ];

    const rangeStats = ranges.map(range => {
      const tradesInRange = tradesWithHoldTime.filter(t => t.holdMinutes >= range.min && t.holdMinutes < range.max);
      if (tradesInRange.length === 0) return null;
      return {
        range: range.name,
        avgPnL: tradesInRange.reduce((sum, t) => sum + (t.pnl || 0), 0) / tradesInRange.length,
        count: tradesInRange.length,
      };
    }).filter(Boolean);

    const best = rangeStats.reduce((best, curr) => curr!.avgPnL > (best?.avgPnL || -Infinity) ? curr : best, null as any);

    if (!best || best.count < 5) return {};

    return {
      optimalRange: best.range,
      avgPnL: best.avgPnL,
      count: best.count,
      comparison: best.range.includes('under') ? 'longer' : 'shorter',
    };
  };

  const analyzeWeekdayPerformance = (trades: any[]): any => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayStats: Record<number, { wins: number; total: number; pnl: number }> = {};

    trades.forEach(trade => {
      const day = new Date(trade.entry_date).getDay();
      if (!dayStats[day]) {
        dayStats[day] = { wins: 0, total: 0, pnl: 0 };
      }
      dayStats[day].total += 1;
      if (trade.pnl > 0) dayStats[day].wins += 1;
      dayStats[day].pnl += trade.pnl || 0;
    });

    let bestDay = null;
    let bestScore = -Infinity;

    Object.entries(dayStats).forEach(([day, stats]) => {
      if (stats.total < 3) return;
      const winRate = (stats.wins / stats.total) * 100;
      const avgPnL = stats.pnl / stats.total;
      const score = winRate * 0.5 + avgPnL;

      if (score > bestScore) {
        bestScore = score;
        bestDay = days[parseInt(day)];
      }
    });

    if (!bestDay) return {};

    const dayNum = days.indexOf(bestDay);
    return {
      bestDay,
      winRate: (dayStats[dayNum].wins / dayStats[dayNum].total) * 100,
      avgPnL: dayStats[dayNum].pnl / dayStats[dayNum].total,
    };
  };

  const analyzeEmotionalPatterns = (trades: any[]): any => {
    const tradesWithEmotions = trades.filter(t => t.pre_trade_emotion || t.emotional_state);
    if (tradesWithEmotions.length < 10) return {};

    const emotionStats: Record<string, { wins: number; total: number; pnl: number }> = {};

    tradesWithEmotions.forEach(trade => {
      const emotion = trade.pre_trade_emotion || 'unknown';
      if (!emotionStats[emotion]) {
        emotionStats[emotion] = { wins: 0, total: 0, pnl: 0 };
      }
      emotionStats[emotion].total += 1;
      if (trade.pnl > 0) emotionStats[emotion].wins += 1;
      emotionStats[emotion].pnl += trade.pnl || 0;
    });

    let bestEmotion = null;
    let worstEmotion = null;
    let bestAvgPnL = -Infinity;
    let worstAvgPnL = Infinity;

    Object.entries(emotionStats).forEach(([emotion, stats]) => {
      if (stats.total < 3) return;
      const avgPnL = stats.pnl / stats.total;
      if (avgPnL > bestAvgPnL) {
        bestAvgPnL = avgPnL;
        bestEmotion = emotion;
      }
      if (avgPnL < worstAvgPnL) {
        worstAvgPnL = avgPnL;
        worstEmotion = emotion;
      }
    });

    if (!bestEmotion || !worstEmotion) return {};

    return {
      insight: `Your best trades happen when you feel "${bestEmotion}" (avg P&L: $${bestAvgPnL.toFixed(2)}), while trades taken when "${worstEmotion}" average $${worstAvgPnL.toFixed(2)}. Track your emotional state before trading to identify optimal mental conditions.`,
      data: { bestEmotion, bestAvgPnL, worstEmotion, worstAvgPnL },
    };
  };

  const markAsRead = async (id: string) => {
    await supabase
      .from('ai_insights')
      .update({ is_read: true })
      .eq('id', id);

    setInsights(insights.map(i => i.id === id ? { ...i, is_read: true } : i));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-5 h-5" />;
      case 'recommendation': return <Lightbulb className="w-5 h-5" />;
      case 'pattern_detected': return <Target className="w-5 h-5" />;
      case 'milestone': return <TrendingUp className="w-5 h-5" />;
      default: return <Brain className="w-5 h-5" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-50 border-red-200 text-red-900';
      case 'high': return 'bg-orange-50 border-orange-200 text-orange-900';
      case 'normal': return 'bg-blue-50 border-blue-200 text-blue-900';
      default: return 'bg-gray-50 border-gray-200 text-gray-900';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error && insights.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">AI Trading Coach</h1>
            <p className="text-gray-600 mt-1">Personalized insights and performance analysis</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={() => { setError(null); loadInsights(); }}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI Trading Coach</h1>
          <p className="text-gray-600 mt-1">Personalized insights and performance analysis</p>
        </div>
        <button
          onClick={generateInsights}
          disabled={generating}
          className="flex items-center space-x-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-6 py-3 rounded-lg transition font-medium shadow-lg disabled:opacity-50"
        >
          <Brain className={`w-5 h-5 ${generating ? 'animate-pulse' : ''}`} />
          <span>{generating ? 'Analyzing...' : 'Generate Insights'}</span>
        </button>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {insights.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-200 text-center">
          <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Insights Yet</h3>
          <p className="text-gray-500 mb-6">Generate AI-powered insights from your trading data.</p>
          <button
            onClick={generateInsights}
            disabled={generating}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg transition font-medium disabled:opacity-50"
          >
            {generating ? 'Analyzing...' : 'Generate First Insights'}
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className={`border rounded-xl p-6 transition ${
                insight.is_read ? 'bg-gray-50 border-gray-200 opacity-60' : getPriorityColor(insight.priority)
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4 flex-1">
                  <div className={`p-3 rounded-lg ${
                    insight.priority === 'urgent' ? 'bg-red-100' :
                    insight.priority === 'high' ? 'bg-orange-100' :
                    'bg-blue-100'
                  }`}>
                    {getIcon(insight.insight_type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-lg font-semibold">{insight.title}</h3>
                      <span className="text-xs px-2 py-1 rounded-full bg-white/50 font-medium">
                        {insight.insight_type.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed mb-2">{insight.content}</p>
                    <div className="flex items-center space-x-2 text-xs text-gray-600">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(insight.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                {!insight.is_read && (
                  <button
                    onClick={() => markAsRead(insight.id)}
                    className="ml-4 text-xs text-gray-600 hover:text-gray-900 underline"
                  >
                    Mark Read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
