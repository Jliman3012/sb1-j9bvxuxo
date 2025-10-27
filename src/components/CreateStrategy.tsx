import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft } from 'lucide-react';

interface CreateStrategyProps {
  onBack: () => void;
}

export default function CreateStrategy({ onBack }: CreateStrategyProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    strategy_type: 'trend_following',
    entry_indicator: 'sma_cross',
    entry_period_fast: '10',
    entry_period_slow: '20',
    exit_type: 'take_profit_stop_loss',
    take_profit_percent: '2',
    stop_loss_percent: '1',
    position_size_percent: '10',
    max_trades: '3',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const entry_rules = {
        indicator: formData.entry_indicator,
        period_fast: parseInt(formData.entry_period_fast),
        period_slow: parseInt(formData.entry_period_slow),
      };

      const exit_rules = {
        type: formData.exit_type,
        take_profit_percent: parseFloat(formData.take_profit_percent),
        stop_loss_percent: parseFloat(formData.stop_loss_percent),
      };

      const risk_management = {
        position_size_percent: parseFloat(formData.position_size_percent),
        max_simultaneous_trades: parseInt(formData.max_trades),
      };

      const { error } = await supabase.from('strategies').insert({
        user_id: user!.id,
        name: formData.name,
        description: formData.description || null,
        strategy_type: formData.strategy_type,
        entry_rules,
        exit_rules,
        risk_management,
      });

      if (error) throw error;

      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-3xl">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Trading Strategy</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Strategy Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="My Trend Following Strategy"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              rows={3}
              placeholder="Describe your strategy..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Strategy Type
            </label>
            <select
              value={formData.strategy_type}
              onChange={(e) => setFormData({ ...formData, strategy_type: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="trend_following">Trend Following</option>
              <option value="mean_reversion">Mean Reversion</option>
              <option value="breakout">Breakout</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Entry Rules</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Entry Indicator
                </label>
                <select
                  value={formData.entry_indicator}
                  onChange={(e) => setFormData({ ...formData, entry_indicator: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="sma_cross">SMA Crossover</option>
                  <option value="ema_cross">EMA Crossover</option>
                  <option value="rsi">RSI</option>
                  <option value="macd">MACD</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fast Period
                  </label>
                  <input
                    type="number"
                    value={formData.entry_period_fast}
                    onChange={(e) => setFormData({ ...formData, entry_period_fast: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Slow Period
                  </label>
                  <input
                    type="number"
                    value={formData.entry_period_slow}
                    onChange={(e) => setFormData({ ...formData, entry_period_slow: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    min="1"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Exit Rules</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Exit Type
                </label>
                <select
                  value={formData.exit_type}
                  onChange={(e) => setFormData({ ...formData, exit_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="take_profit_stop_loss">Take Profit & Stop Loss</option>
                  <option value="trailing_stop">Trailing Stop</option>
                  <option value="indicator_signal">Indicator Signal</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Take Profit (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.take_profit_percent}
                    onChange={(e) => setFormData({ ...formData, take_profit_percent: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    min="0.1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stop Loss (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.stop_loss_percent}
                    onChange={(e) => setFormData({ ...formData, stop_loss_percent: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    min="0.1"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Management</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Position Size (% of Capital)
                </label>
                <input
                  type="number"
                  step="1"
                  value={formData.position_size_percent}
                  onChange={(e) => setFormData({ ...formData, position_size_percent: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  min="1"
                  max="100"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Simultaneous Trades
                </label>
                <input
                  type="number"
                  value={formData.max_trades}
                  onChange={(e) => setFormData({ ...formData, max_trades: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  min="1"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex space-x-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Strategy...' : 'Create Strategy'}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="px-6 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
