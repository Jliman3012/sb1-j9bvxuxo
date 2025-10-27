import { useEffect, useState } from 'react';
import { supabase, Trade } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  TrendingUp,
  Clock,
  Shield,
  Brain,
  Target,
  Award,
  AlertTriangle,
  Activity,
  BarChart3,
  Zap,
  RefreshCw,
  Download,
} from 'lucide-react';
import {
  calculateTimeAnalytics,
  calculateRiskMetrics,
  calculatePsychologyMetrics,
  calculateSymbolPerformance,
  generateAIInsights,
  TimeAnalytics,
  RiskMetrics,
  PsychologyMetrics,
  SymbolPerformance,
} from '../lib/analyticsCalculator';

export default function AdvancedAnalytics() {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeAnalytics, setTimeAnalytics] = useState<TimeAnalytics | null>(null);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [psychMetrics, setPsychMetrics] = useState<PsychologyMetrics | null>(null);
  const [symbolPerf, setSymbolPerf] = useState<SymbolPerformance[]>([]);
  const [aiInsights, setAiInsights] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      console.log('Loading analytics data...');
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user!.id)
        .order('entry_date', { ascending: false });

      if (error) throw error;

      const tradesData = data || [];
      setTrades(tradesData);

      if (tradesData.length > 0) {
        const timeData = calculateTimeAnalytics(tradesData);
        const riskData = calculateRiskMetrics(tradesData);
        const psychData = calculatePsychologyMetrics(tradesData);
        const symbolData = calculateSymbolPerformance(tradesData);
        const insights = generateAIInsights(tradesData, timeData, riskData, psychData);

        setTimeAnalytics(timeData);
        setRiskMetrics(riskData);
        setPsychMetrics(psychData);
        setSymbolPerf(symbolData);
        setAiInsights(insights);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const exportToCSV = () => {
    const completedTrades = trades.filter(t => t.exit_price && t.pnl !== null);
    const headers = ['Date', 'Symbol', 'Type', 'Entry', 'Exit', 'Quantity', 'P&L', 'Win Rate'];
    const rows = completedTrades.map(t => [
      new Date(t.entry_date).toLocaleDateString(),
      t.symbol,
      t.trade_type,
      t.entry_price,
      t.exit_price,
      t.quantity,
      t.pnl,
      '',
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-12 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
        <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Data Yet</h3>
        <p className="text-gray-500 dark:text-gray-400">Start logging trades to unlock powerful analytics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Advanced Analytics</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">AI-powered insights into your trading performance</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={exportToCSV}
            className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition font-medium"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
          <button
            onClick={refreshData}
            disabled={refreshing}
            className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {aiInsights.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center space-x-3 mb-4">
            <Brain className="w-6 h-6" />
            <h2 className="text-xl font-bold">AI Coach Insights</h2>
          </div>
          <div className="space-y-2">
            {aiInsights.map((insight, i) => (
              <p key={i} className="text-white/90">{insight}</p>
            ))}
          </div>
        </div>
      )}

      {riskMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Risk Health"
            value={`${riskMetrics.riskHealthScore}%`}
            icon={<Shield className="w-6 h-6" />}
            color={riskMetrics.riskHealthScore >= 70 ? 'emerald' : riskMetrics.riskHealthScore >= 50 ? 'amber' : 'red'}
            subtitle="Safety score"
          />
          <MetricCard
            title="Sharpe Ratio"
            value={riskMetrics.sharpeRatio.toFixed(2)}
            icon={<Activity className="w-6 h-6" />}
            color={riskMetrics.sharpeRatio >= 1 ? 'emerald' : 'amber'}
            subtitle="Risk-adjusted return"
          />
          <MetricCard
            title="Max Drawdown"
            value={`$${riskMetrics.maxDrawdown.toFixed(2)}`}
            icon={<AlertTriangle className="w-6 h-6" />}
            color="red"
            subtitle="Largest loss"
          />
          <MetricCard
            title="Profit Factor"
            value={riskMetrics.profitFactor.toFixed(2)}
            icon={<TrendingUp className="w-6 h-6" />}
            color={riskMetrics.profitFactor >= 2 ? 'emerald' : riskMetrics.profitFactor >= 1 ? 'blue' : 'red'}
            subtitle="Gross profit / loss"
          />
        </div>
      )}

      {timeAnalytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2 mb-4">
              <Clock className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Performance by Hour</h3>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {timeAnalytics.hourlyPerformance
                .filter(h => h.trades > 0)
                .sort((a, b) => b.pnl - a.pnl)
                .slice(0, 10)
                .map((hour, i) => (
                  <div key={i} className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-gray-700 rounded">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{hour.hour}:00</span>
                    <div className="flex items-center space-x-4">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{hour.trades} trades</span>
                      <span className={`text-sm font-semibold ${hour.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        ${hour.pnl.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2 mb-4">
              <Target className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Day of Week Performance</h3>
            </div>
            <div className="space-y-2">
              {timeAnalytics.dailyPerformance
                .filter(d => d.trades > 0)
                .sort((a, b) => b.pnl - a.pnl)
                .map((day, i) => (
                  <div key={i} className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-gray-700 rounded">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{day.day}</span>
                    <div className="flex items-center space-x-4">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{day.winRate.toFixed(0)}% WR</span>
                      <span className={`text-sm font-semibold ${day.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        ${day.pnl.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {timeAnalytics && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-amber-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Trading Session Performance</h3>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Consistency Score:</span>
              <span className={`text-lg font-bold ${
                timeAnalytics.consistencyScore >= 70 ? 'text-emerald-600' :
                timeAnalytics.consistencyScore >= 50 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {timeAnalytics.consistencyScore}%
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {timeAnalytics.sessionPerformance.map((session, i) => (
              <div key={i} className="bg-slate-50 dark:bg-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{session.session}</p>
                <p className={`text-xl font-bold ${session.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  ${session.pnl.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {session.trades} trades • {session.winRate.toFixed(0)}% WR
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {psychMetrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2 mb-4">
              <Brain className="w-5 h-5 text-pink-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Psychology Metrics</h3>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Discipline Score</span>
                  <span className={`text-sm font-semibold ${
                    psychMetrics.disciplineScore >= 70 ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    {psychMetrics.disciplineScore}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      psychMetrics.disciplineScore >= 70 ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${psychMetrics.disciplineScore}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Overtrading Index</span>
                  <span className={`text-sm font-semibold ${
                    psychMetrics.overtradingIndex <= 40 ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {psychMetrics.overtradingIndex.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      psychMetrics.overtradingIndex <= 40 ? 'bg-emerald-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${psychMetrics.overtradingIndex}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {psychMetrics.emotionCorrelation.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2 mb-4">
                <Award className="w-5 h-5 text-orange-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Emotion Impact</h3>
              </div>
              <div className="space-y-2">
                {psychMetrics.emotionCorrelation
                  .sort((a, b) => b.avgPnl - a.avgPnl)
                  .slice(0, 6)
                  .map((emotion, i) => (
                    <div key={i} className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-gray-700 rounded">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{emotion.emotion}</span>
                      <div className="flex items-center space-x-3">
                        <span className="text-xs text-gray-500 dark:text-gray-400">{emotion.count}×</span>
                        <span className={`text-sm font-semibold ${emotion.avgPnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          ${emotion.avgPnl.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {symbolPerf.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Symbol Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Symbol</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Trades</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Win Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Avg R:R</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Expectancy</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Total P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {symbolPerf.slice(0, 10).map((symbol, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-gray-900">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">{symbol.symbol}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{symbol.trades}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{symbol.winRate.toFixed(1)}%</td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{symbol.avgRR.toFixed(2)}</td>
                    <td className={`px-6 py-4 text-sm font-semibold ${symbol.expectancy >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      ${symbol.expectancy.toFixed(2)}
                    </td>
                    <td className={`px-6 py-4 text-sm font-semibold ${symbol.totalPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      ${symbol.totalPnL.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: 'emerald' | 'blue' | 'amber' | 'red' | 'purple';
  subtitle?: string;
}

function MetricCard({ title, value, icon, color, subtitle }: MetricCardProps) {
  const colorClasses = {
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-600 dark:text-gray-400">{title}</span>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}
