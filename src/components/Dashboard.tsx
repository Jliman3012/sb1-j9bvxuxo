import { useEffect, useState } from 'react';
import { supabase, Trade } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { TrendingUp, TrendingDown, DollarSign, Activity, Award } from 'lucide-react';

export default function Dashboard() {
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

  const stats = {
    totalTrades: trades.length,
    winningTrades: trades.filter(t => t.pnl > 0).length,
    losingTrades: trades.filter(t => t.pnl < 0).length,
    totalPnL: trades.reduce((sum, t) => sum + Number(t.pnl), 0),
    winRate: trades.length > 0
      ? (trades.filter(t => t.pnl > 0).length / trades.length * 100).toFixed(1)
      : '0.0',
    avgWin: trades.filter(t => t.pnl > 0).length > 0
      ? trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + Number(t.pnl), 0) / trades.filter(t => t.pnl > 0).length
      : 0,
    avgLoss: trades.filter(t => t.pnl < 0).length > 0
      ? trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + Number(t.pnl), 0) / trades.filter(t => t.pnl < 0).length
      : 0,
  };

  const recentTrades = trades.slice(0, 5);

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
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total P&L</p>
              <p className={`text-2xl font-bold ${stats.totalPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                ${stats.totalPnL.toFixed(2)}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${stats.totalPnL >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
              <DollarSign className={`w-6 h-6 ${stats.totalPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Win Rate</p>
              <p className="text-2xl font-bold text-gray-900">{stats.winRate}%</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-100">
              <Award className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Trades</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalTrades}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-100">
              <Activity className="w-6 h-6 text-slate-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Win/Loss</p>
              <p className="text-2xl font-bold text-gray-900">
                <span className="text-emerald-600">{stats.winningTrades}</span>
                <span className="text-gray-400 text-lg mx-1">/</span>
                <span className="text-red-600">{stats.losingTrades}</span>
              </p>
            </div>
            <div className="p-3 rounded-lg bg-amber-100">
              <TrendingUp className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Performance Metrics</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Average Win</span>
              <span className="text-emerald-600 font-semibold">${stats.avgWin.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Average Loss</span>
              <span className="text-red-600 font-semibold">${Math.abs(stats.avgLoss).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Profit Factor</span>
              <span className="text-gray-900 font-semibold">
                {stats.avgLoss !== 0 ? (Math.abs(stats.avgWin / stats.avgLoss)).toFixed(2) : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Trades</h2>
          {recentTrades.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No trades yet. Add your first trade!</p>
          ) : (
            <div className="space-y-3">
              {recentTrades.map((trade) => (
                <div key={trade.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {trade.pnl >= 0 ? (
                      <TrendingUp className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-600" />
                    )}
                    <div>
                      <p className="font-semibold text-gray-900">{trade.symbol}</p>
                      <p className="text-sm text-gray-600">{trade.trade_type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${trade.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {trade.pnl >= 0 ? '+' : ''}${Number(trade.pnl).toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-600">{trade.pnl_percentage.toFixed(2)}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
