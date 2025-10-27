import { useState, useEffect } from 'react';
import { supabase, BrokerAccount } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft } from 'lucide-react';

interface AddTradeProps {
  onBack: () => void;
}

export default function AddTrade({ onBack }: AddTradeProps) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<BrokerAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    account_id: '',
    symbol: '',
    trade_type: 'long',
    entry_date: new Date().toISOString().slice(0, 16),
    exit_date: '',
    entry_price: '',
    exit_price: '',
    quantity: '',
    fees: '0',
    stop_price: '',
    initial_risk: '',
    status: 'closed',
    notes: '',
  });

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('broker_accounts')
        .select('*')
        .eq('user_id', user!.id);

      if (error) throw error;
      setAccounts(data || []);
      if (data && data.length > 0) {
        setFormData(prev => ({ ...prev, account_id: data[0].id }));
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const calculatePnL = () => {
    const entryPrice = parseFloat(formData.entry_price);
    const exitPrice = parseFloat(formData.exit_price);
    const quantity = parseFloat(formData.quantity);
    const feesValue = parseFloat(formData.fees);
    const fees = isNaN(feesValue) ? 0 : feesValue;
    const stopPrice = parseFloat(formData.stop_price);
    const manualRisk = parseFloat(formData.initial_risk);

    if (!entryPrice || !quantity) {
      const fallbackRisk = calculateInitialRisk(entryPrice, quantity, stopPrice, manualRisk);
      return { pnl: 0, pnlPercentage: 0, rMultiple: 0, initialRisk: fallbackRisk };
    }

    if (!exitPrice) {
      const derivedRisk = calculateInitialRisk(entryPrice, quantity, stopPrice, manualRisk);
      return { pnl: 0, pnlPercentage: 0, rMultiple: 0, initialRisk: derivedRisk };
    }

    let pnl = 0;
    if (formData.trade_type === 'long') {
      pnl = (exitPrice - entryPrice) * quantity - fees;
    } else {
      pnl = (entryPrice - exitPrice) * quantity - fees;
    }

    const pnlPercentage = (pnl / (entryPrice * quantity)) * 100;
    const initialRisk = calculateInitialRisk(entryPrice, quantity, stopPrice, manualRisk, formData.trade_type);
    const rMultiple = initialRisk > 0 ? pnl / initialRisk : 0;

    return { pnl, pnlPercentage, rMultiple, initialRisk };
  };

  const calculateInitialRisk = (
    entryPrice: number,
    quantity: number,
    stopPrice: number,
    manualRisk: number,
    tradeType: 'long' | 'short' = formData.trade_type as 'long' | 'short'
  ) => {
    const size = isNaN(quantity) ? 0 : quantity;
    let derivedRisk = 0;

    if (!isNaN(stopPrice) && stopPrice > 0 && size > 0 && !isNaN(entryPrice)) {
      const priceDiff =
        tradeType === 'long'
          ? entryPrice - stopPrice
          : stopPrice - entryPrice;

      if (priceDiff > 0) {
        derivedRisk = Math.abs(priceDiff * size);
      }
    }

    const cleanedManualRisk = !isNaN(manualRisk) ? Math.abs(manualRisk) : 0;
    if (cleanedManualRisk > 0) {
      return cleanedManualRisk;
    }

    return derivedRisk;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (accounts.length === 0) {
        throw new Error('Please add a broker account first');
      }

      const { pnl, pnlPercentage, rMultiple, initialRisk } = calculatePnL();

      const { error } = await supabase.from('trades').insert({
        user_id: user!.id,
        account_id: formData.account_id,
        symbol: formData.symbol.toUpperCase(),
        trade_type: formData.trade_type,
        entry_date: formData.entry_date,
        exit_date: formData.exit_date || null,
        entry_price: parseFloat(formData.entry_price),
        exit_price: formData.exit_price ? parseFloat(formData.exit_price) : null,
        quantity: parseFloat(formData.quantity),
        pnl,
        pnl_percentage: pnlPercentage,
        fees: parseFloat(formData.fees),
        status: formData.status,
        notes: formData.notes || null,
        stop_price: formData.stop_price ? parseFloat(formData.stop_price) : null,
        initial_risk: initialRisk && initialRisk > 0 ? initialRisk : null,
        r_multiple: initialRisk && initialRisk > 0 ? rMultiple : null,
      });

      if (error) throw error;

      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const { pnl, pnlPercentage, rMultiple, initialRisk } = calculatePnL();

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Back to Trades</span>
      </button>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 max-w-3xl">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Add New Trade</h2>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {accounts.length === 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 px-4 py-3 rounded-lg mb-4">
            You need to add a broker account first before adding trades.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Account
              </label>
              <select
                value={formData.account_id}
                onChange={(e) => updateField('account_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                required
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.account_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Symbol
              </label>
              <input
                type="text"
                value={formData.symbol}
                onChange={(e) => updateField('symbol', e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                placeholder="AAPL"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateField('trade_type', 'long')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    formData.trade_type === 'long'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Long
                </button>
                <button
                  type="button"
                  onClick={() => updateField('trade_type', 'short')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    formData.trade_type === 'short'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Short
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Entry Price
              </label>
              <input
                type="number"
                step="any"
                value={formData.entry_price}
                onChange={(e) => updateField('entry_price', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                placeholder="150.50"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Exit Price
              </label>
              <input
                type="number"
                step="any"
                value={formData.exit_price}
                onChange={(e) => updateField('exit_price', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                placeholder="155.75"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Quantity
              </label>
              <input
                type="number"
                step="any"
                value={formData.quantity}
                onChange={(e) => updateField('quantity', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                placeholder="100"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Entry Date
              </label>
              <input
                type="datetime-local"
                value={formData.entry_date}
                onChange={(e) => updateField('entry_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Exit Date
              </label>
              <input
                type="datetime-local"
                value={formData.exit_date}
                onChange={(e) => updateField('exit_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fees
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.fees}
                onChange={(e) => updateField('fees', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Planned Stop Price
              </label>
              <input
                type="number"
                step="any"
                value={formData.stop_price}
                onChange={(e) => updateField('stop_price', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                placeholder="142.00"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Used to estimate risk. For longs use stop below entry, for shorts above entry.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Initial Risk (USD)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.initial_risk}
                onChange={(e) => updateField('initial_risk', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                placeholder="250"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Leave blank to auto-calc from stop. We'll use whichever is higher confidence.
              </p>
            </div>
          </div>

          {formData.entry_price && formData.quantity && (
            <div className="bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-emerald-900/20 dark:to-blue-900/20 rounded-lg p-5 border-2 border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Estimated P&L</p>
                  <p className={`text-3xl font-bold ${pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Return</p>
                  <p className={`text-3xl font-bold ${pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {pnl >= 0 ? '+' : ''}{pnlPercentage.toFixed(2)}%
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Initial Risk</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {initialRisk && initialRisk > 0 ? `$${initialRisk.toFixed(2)}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">R Multiple</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {initialRisk && initialRisk > 0 ? rMultiple.toFixed(2) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Stop Price</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formData.stop_price ? `$${parseFloat(formData.stop_price).toFixed(2)}` : '—'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              rows={3}
              placeholder="Strategy, emotions, lessons learned..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || accounts.length === 0}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/30"
            >
              {loading ? 'Saving...' : 'Save Trade'}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="px-8 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold py-3 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
