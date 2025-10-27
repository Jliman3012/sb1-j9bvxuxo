import { useEffect, useState } from 'react';
import { supabase, Trade } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { TrendingUp, Calendar, Target, BarChart3 } from 'lucide-react';

export default function Analytics() {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadTrades();
    }
  }, [user]);

  const loadTrades = async () => {
    try {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user!.id)
        .order('entry_date', { ascending: false });

      if (error) throw error;
      setTrades(data || []);
    } catch (error) {
      console.error('Error loading trades:', error);
    } finally {
      setLoading(false);
    }
  };

  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl < 0);
  const longTrades = trades.filter(t => t.trade_type === 'long');
  const shortTrades = trades.filter(t => t.trade_type === 'short');

  const stats = {
    totalPnL: trades.reduce((sum, t) => sum + Number(t.pnl), 0),
    winRate: trades.length > 0 ? (winningTrades.length / trades.length * 100) : 0,
    avgWin: winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + Number(t.pnl), 0) / winningTrades.length
      : 0,
    avgLoss: losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + Number(t.pnl), 0) / losingTrades.length
      : 0,
    profitFactor: 0,
    largestWin: winningTrades.length > 0
      ? Math.max(...winningTrades.map(t => Number(t.pnl)))
      : 0,
    largestLoss: losingTrades.length > 0
      ? Math.min(...losingTrades.map(t => Number(t.pnl)))
      : 0,
    longWinRate: longTrades.length > 0
      ? (longTrades.filter(t => t.pnl > 0).length / longTrades.length * 100)
      : 0,
    shortWinRate: shortTrades.length > 0
      ? (shortTrades.filter(t => t.pnl > 0).length / shortTrades.length * 100)
      : 0,
    avgHoldingTime: 0,
  };

  const totalWins = winningTrades.reduce((sum, t) => sum + Number(t.pnl), 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + Number(t.pnl), 0));
  stats.profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;

  const closedTrades = trades.filter(t => t.exit_date);
  if (closedTrades.length > 0) {
    const totalHoldingTime = closedTrades.reduce((sum, t) => {
      const entryTime = new Date(t.entry_date).getTime();
      const exitTime = new Date(t.exit_date!).getTime();
      return sum + (exitTime - entryTime);
    }, 0);
    stats.avgHoldingTime = totalHoldingTime / closedTrades.length / (1000 * 60 * 60);
  }

  const symbolStats = trades.reduce((acc, trade) => {
    if (!acc[trade.symbol]) {
      acc[trade.symbol] = { count: 0, pnl: 0, wins: 0 };
    }
    acc[trade.symbol].count++;
    acc[trade.symbol].pnl += Number(trade.pnl);
    if (trade.pnl > 0) acc[trade.symbol].wins++;
    return acc;
  }, {} as Record<string, { count: number; pnl: number; wins: number }>);

  const topSymbols = Object.entries(symbolStats)
    .map(([symbol, data]) => ({
      symbol,
      ...data,
      winRate: (data.wins / data.count * 100),
    }))
    .sort((a, b) => b.pnl - a.pnl)
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Profit Factor</span>
            <BarChart3 className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.profitFactor.toFixed(2)}</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Avg Win</span>
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">${stats.avgWin.toFixed(2)}</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Avg Loss</span>
            <TrendingUp className="w-5 h-5 text-red-600 rotate-180" />
          </div>
          <p className="text-2xl font-bold text-red-600">${Math.abs(stats.avgLoss).toFixed(2)}</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Avg Hold Time</span>
            <Calendar className="w-5 h-5 text-slate-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.avgHoldingTime.toFixed(1)}h</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Best & Worst Trades</h2>
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Largest Win</p>
              <p className="text-2xl font-bold text-emerald-600">${stats.largestWin.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Largest Loss</p>
              <p className="text-2xl font-bold text-red-600">${stats.largestLoss.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Trade Type Performance</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-700 font-medium">Long Trades</span>
                <span className="text-sm text-gray-600">{longTrades.length} trades</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-500 h-3 rounded-full transition-all"
                  style={{ width: `${stats.longWinRate}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-1">{stats.longWinRate.toFixed(1)}% win rate</p>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-700 font-medium">Short Trades</span>
                <span className="text-sm text-gray-600">{shortTrades.length} trades</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-orange-500 h-3 rounded-full transition-all"
                  style={{ width: `${stats.shortWinRate}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-1">{stats.shortWinRate.toFixed(1)}% win rate</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Top Performing Symbols</h2>
        {topSymbols.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No data available yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Symbol</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Trades</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Win Rate</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Total P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {topSymbols.map((item) => (
                  <tr key={item.symbol} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-gray-900">{item.symbol}</td>
                    <td className="py-3 px-4 text-right text-gray-700">{item.count}</td>
                    <td className="py-3 px-4 text-right text-gray-700">{item.winRate.toFixed(1)}%</td>
                    <td className={`py-3 px-4 text-right font-semibold ${
                      item.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {item.pnl >= 0 ? '+' : ''}${item.pnl.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
