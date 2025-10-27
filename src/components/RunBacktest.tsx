import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Play, TrendingUp } from 'lucide-react';

interface RunBacktestProps {
  onBack: () => void;
}

const SYMBOLS = [
  { value: 'BTCUSD', label: 'Bitcoin (BTC/USD)' },
  { value: 'ETHUSD', label: 'Ethereum (ETH/USD)' },
  { value: 'AAPL', label: 'Apple (AAPL)' },
  { value: 'TSLA', label: 'Tesla (TSLA)' },
  { value: 'SPY', label: 'S&P 500 ETF (SPY)' },
  { value: 'EURUSD', label: 'EUR/USD' },
  { value: 'GBPUSD', label: 'GBP/USD' },
];

export default function RunBacktest({ onBack }: RunBacktestProps) {
  const { user } = useAuth();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    strategyName: '',
    capital: '10000',
    symbol: 'BTCUSD',
    timeframe: '1D',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.strategyName.trim()) {
      setError('Please enter a strategy name');
      return;
    }

    if (parseFloat(formData.capital) <= 0) {
      setError('Initial capital must be greater than 0');
      return;
    }

    setRunning(true);

    try {
      console.log('Starting backtest with params:', {
        user_id: user!.id,
        strategy_name: formData.strategyName,
        symbol: formData.symbol,
        timeframe: formData.timeframe,
        initial_capital: parseFloat(formData.capital),
      });

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-backtest`;
      console.log('Calling API:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user!.id,
          strategy_name: formData.strategyName,
          symbol: formData.symbol,
          timeframe: formData.timeframe,
          initial_capital: parseFloat(formData.capital),
        }),
      });

      console.log('Response status:', response.status);
      const result = await response.json();
      console.log('Response data:', result);

      if (!response.ok) {
        throw new Error(result.error || `Server error: ${response.status}`);
      }

      if (!result.success) {
        throw new Error(result.error || 'Backtest failed');
      }

      setSuccess('Backtest completed successfully! Redirecting...');
      setTimeout(() => {
        onBack();
      }, 2000);
    } catch (err) {
      console.error('Backtest error:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(`Failed to run backtest: ${errorMessage}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6 transition"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Back to Backtesting</span>
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-2xl">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-emerald-100 p-3 rounded-lg">
            <TrendingUp className="w-8 h-8 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Run Backtest</h2>
            <p className="text-gray-600 text-sm">Test your strategy with real market data</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg mb-4">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Strategy Name
            </label>
            <input
              type="text"
              value={formData.strategyName}
              onChange={(e) => setFormData({ ...formData, strategyName: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-lg"
              placeholder="My SMA Crossover Strategy"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Give your strategy a memorable name</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Initial Capital ($)
            </label>
            <input
              type="number"
              step="100"
              value={formData.capital}
              onChange={(e) => setFormData({ ...formData, capital: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-lg"
              placeholder="10000"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Starting balance for your backtest</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Symbol
            </label>
            <select
              value={formData.symbol}
              onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-lg"
            >
              {SYMBOLS.map((symbol) => (
                <option key={symbol.value} value={symbol.value}>
                  {symbol.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Choose the asset to backtest</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Timeframe
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['1m', '5m', '15m', '1h', '4h', '1D'].map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setFormData({ ...formData, timeframe: tf })}
                  className={`px-4 py-3 rounded-lg font-medium transition ${
                    formData.timeframe === tf
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">Select chart interval for analysis</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900 font-medium mb-1">Using Real Market Data</p>
            <p className="text-xs text-blue-700">
              Backtests use live data from free financial APIs. Results may take a few moments to calculate.
            </p>
          </div>

          <div className="flex space-x-4 pt-4">
            <button
              type="submit"
              disabled={running}
              className="flex-1 flex items-center justify-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/30"
            >
              <Play className={`w-5 h-5 ${running ? 'animate-spin' : ''}`} />
              <span>{running ? 'Running Backtest...' : 'Run Backtest'}</span>
            </button>
            <button
              type="button"
              onClick={onBack}
              disabled={running}
              className="px-6 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-4 rounded-lg transition disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
