import { useEffect, useState } from 'react';
import { supabase, Backtest } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Play, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle } from 'lucide-react';

interface BacktestingProps {
  onNavigate: (page: string, data?: any) => void;
}

export default function Backtesting({ onNavigate }: BacktestingProps) {
  const { user } = useAuth();
  const [backtests, setBacktests] = useState<Backtest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadBacktests();
    }
  }, [user]);

  const loadBacktests = async () => {
    try {
      console.log('Loading backtests for user:', user!.id);
      const { data, error } = await supabase
        .from('backtests')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error loading backtests:', error);
        throw error;
      }

      console.log('Loaded backtests:', data?.length || 0);
      setBacktests(data || []);
      setError(null);
    } catch (error) {
      console.error('Error loading backtests:', error);
      setError('Failed to load backtests. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-emerald-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'running':
        return <Clock className="w-5 h-5 text-blue-600 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'failed':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'running':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Backtesting</h1>
          <p className="text-gray-600 mt-1">Test your trading strategies on historical data</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={() => { setError(null); loadBacktests(); }}
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
          <h1 className="text-3xl font-bold text-gray-900">Backtesting</h1>
          <p className="text-gray-600 mt-1">Test your trading strategies on historical data</p>
        </div>
        <button
          onClick={() => onNavigate('run-backtest')}
          className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg transition font-medium shadow-lg shadow-emerald-500/30"
        >
          <Play className="w-5 h-5" />
          <span>Run Backtest</span>
        </button>
      </div>

      {backtests.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-200 text-center">
          <Play className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Backtests Yet</h3>
          <p className="text-gray-500 mb-6">Test your trading strategy with real market data.</p>
          <button
            onClick={() => onNavigate('run-backtest')}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg transition font-medium shadow-lg shadow-emerald-500/30"
          >
            Run Your First Backtest
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {backtests.map((backtest) => (
            <div
              key={backtest.id}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition cursor-pointer"
              onClick={() => onNavigate('backtest-results', backtest)}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {backtest.name}
                  </h3>
                  <p className="text-sm text-gray-600">{backtest.results?.symbol || 'Unknown Symbol'}</p>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(backtest.status)}
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                      backtest.status
                    )}`}
                  >
                    {backtest.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Symbol</p>
                  <p className="font-semibold text-gray-900">{backtest.results?.symbol || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Timeframe</p>
                  <p className="font-semibold text-gray-900">{backtest.timeframe}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Period</p>
                  <p className="text-sm text-gray-900">
                    {new Date(backtest.start_date).toLocaleDateString()} - {new Date(backtest.end_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Capital</p>
                  <p className="font-semibold text-gray-900">
                    ${Number(backtest.initial_capital).toLocaleString()}
                  </p>
                </div>
              </div>

              {backtest.status === 'completed' && (
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Total P&L</p>
                      <div className="flex items-center space-x-1">
                        {backtest.total_pnl >= 0 ? (
                          <TrendingUp className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-600" />
                        )}
                        <p
                          className={`font-bold ${
                            backtest.total_pnl >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {backtest.total_pnl >= 0 ? '+' : ''}${Number(backtest.total_pnl).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Win Rate</p>
                      <p className="font-semibold text-gray-900">{backtest.win_rate.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Trades</p>
                      <p className="font-semibold text-gray-900">{backtest.total_trades}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
