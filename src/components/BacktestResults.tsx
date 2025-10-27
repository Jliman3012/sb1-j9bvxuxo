import { Backtest } from '../lib/supabase';
import { ArrowLeft, TrendingUp, TrendingDown, Award, Activity, DollarSign } from 'lucide-react';
import EquityChart from './EquityChart';

interface BacktestResultsProps {
  backtest: Backtest;
  onBack: () => void;
}

export default function BacktestResults({ backtest, onBack }: BacktestResultsProps) {
  const trades = backtest.results?.trades || [];
  const symbol = backtest.results?.symbol || 'Unknown';
  const winningTrades = trades.filter((t: any) => t.pnl > 0);
  const losingTrades = trades.filter((t: any) => t.pnl < 0);

  const avgWin = winningTrades.length > 0
    ? winningTrades.reduce((sum: number, t: any) => sum + t.pnl, 0) / winningTrades.length
    : 0;

  const avgLoss = losingTrades.length > 0
    ? losingTrades.reduce((sum: number, t: any) => sum + t.pnl, 0) / losingTrades.length
    : 0;

  const returnOnInvestment = ((backtest.total_pnl / backtest.initial_capital) * 100).toFixed(2);

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Back to Backtests</span>
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{backtest.name}</h1>
            <p className="text-gray-600">SMA Crossover Strategy</p>
          </div>
          <div className={`px-4 py-2 rounded-lg font-semibold ${
            backtest.total_pnl >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
          }`}>
            {backtest.total_pnl >= 0 ? '+' : ''}${backtest.total_pnl.toFixed(2)}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Symbol</p>
            <p className="font-semibold text-gray-900">{symbol}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Timeframe</p>
            <p className="font-semibold text-gray-900">{backtest.timeframe}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Initial Capital</p>
            <p className="font-semibold text-gray-900">${backtest.initial_capital.toLocaleString()}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Period</p>
            <p className="text-sm text-gray-900">
              {new Date(backtest.start_date).toLocaleDateString()} - {new Date(backtest.end_date).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total P&L</span>
            <DollarSign className={`w-5 h-5 ${backtest.total_pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
          </div>
          <p className={`text-2xl font-bold ${backtest.total_pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {backtest.total_pnl >= 0 ? '+' : ''}${backtest.total_pnl.toFixed(2)}
          </p>
          <p className="text-sm text-gray-600 mt-1">ROI: {returnOnInvestment}%</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Win Rate</span>
            <Award className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{backtest.win_rate.toFixed(1)}%</p>
          <p className="text-sm text-gray-600 mt-1">
            {backtest.winning_trades}W / {backtest.losing_trades}L
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Profit Factor</span>
            <Activity className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{backtest.profit_factor.toFixed(2)}</p>
          <p className="text-sm text-gray-600 mt-1">Higher is better</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total Trades</span>
            <TrendingUp className="w-5 h-5 text-slate-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{backtest.total_trades}</p>
          <p className="text-sm text-gray-600 mt-1">Executed trades</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Average Win</span>
              <span className="font-semibold text-emerald-600">${avgWin.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Average Loss</span>
              <span className="font-semibold text-red-600">${Math.abs(avgLoss).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Max Drawdown</span>
              <span className="font-semibold text-gray-900">${backtest.max_drawdown.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Sharpe Ratio</span>
              <span className="font-semibold text-gray-900">{backtest.sharpe_ratio.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategy Details</h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600 mb-1">Strategy Type</p>
              <p className="font-medium text-gray-900">Trend Following</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Entry Indicator</p>
              <p className="font-medium text-gray-900">
                SMA Crossover (10/20)
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Risk per Trade</p>
              <p className="font-medium text-gray-900">
                10% of capital
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Exit Strategy</p>
              <p className="font-medium text-gray-900">
                TP: 2% / SL: 1%
              </p>
            </div>
          </div>
        </div>
      </div>

      {trades.length > 0 && (
        <EquityChart trades={trades} initialCapital={backtest.initial_capital} />
      )}

      {trades.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Trade History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Entry Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Exit Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Entry Price</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Exit Price</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Size</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {trades.slice(0, 50).map((trade: any, index: number) => (
                  <tr key={index} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(trade.entry_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(trade.exit_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        trade.trade_type === 'long' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {trade.trade_type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">${trade.entry_price.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">${trade.exit_price.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{trade.position_size.toFixed(4)}</td>
                    <td className={`px-6 py-4 text-sm font-semibold ${
                      trade.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {trades.length > 50 && (
            <div className="px-6 py-3 bg-slate-50 border-t border-gray-200 text-sm text-gray-600 text-center">
              Showing first 50 of {trades.length} trades
            </div>
          )}
        </div>
      )}
    </div>
  );
}
