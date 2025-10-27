import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Upload, FileText, AlertCircle, CheckCircle, X, RefreshCw, Download, Sparkles } from 'lucide-react';
import { normalizeCSV, downloadCSV } from '../lib/csvNormalizer';
import { parseNormalizedCSV } from '../lib/tradeParser';

interface ImportTradesProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedTrade {
  symbol: string;
  trade_type: 'long' | 'short';
  entry_date: string;
  exit_date: string | null;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  fees: number;
  notes: string | null;
}

export default function ImportTrades({ onClose, onSuccess }: ImportTradesProps) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [normalizing, setNormalizing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [preview, setPreview] = useState<ParsedTrade[]>([]);
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [normalizedCSV, setNormalizedCSV] = useState('');
  const [normalizationStats, setNormalizationStats] = useState<any>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const { data } = await supabase
        .from('broker_accounts')
        .select('*')
        .eq('user_id', user!.id);

      setAccounts(data || []);
    } catch (err) {
      console.error('Error loading accounts:', err);
    }
  };


  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('📁 File input changed');
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) {
      console.log('❌ No file selected');
      return;
    }

    console.log('✅ File detected:', selectedFile.name, 'Size:', selectedFile.size, 'bytes');
    setFile(selectedFile);
    setError('');
    setSuccess('');
    setNormalizationStats(null);

    if (!selectedFile.name.endsWith('.csv')) {
      const errorMsg = 'Please upload a CSV file';
      console.error('❌', errorMsg);
      setError(errorMsg);
      return;
    }

    setNormalizing(true);
    console.log('⏳ Starting CSV normalization...');

    try {
      const text = await selectedFile.text();
      console.log('✅ File read successfully. Length:', text.length, 'characters');

      console.log('⏳ Normalizing CSV format...');
      const { normalized, stats } = normalizeCSV(text);
      console.log('✅ CSV normalized. Stats:', stats);

      setNormalizedCSV(normalized);
      setNormalizationStats(stats);

      console.log('⏳ Parsing normalized CSV...');
      const parsed = parseNormalizedCSV(normalized);
      console.log('✅ Parsed', parsed.length, 'trades');
      setPreview(parsed);

      let brokerMessage = '';
      if (stats.broker && stats.broker !== 'unknown') {
        brokerMessage = ` Detected ${stats.broker.toUpperCase()} format.`;
      }

      const successMsg = `Successfully normalized and parsed ${parsed.length} trades!${brokerMessage} Matched ${stats.columnsMatched} columns.`;
      console.log('✅', successMsg);
      setSuccess(successMsg);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error processing CSV file';
      console.error('❌ CSV processing error:', errorMsg, err);
      setError(errorMsg);
      setPreview([]);
    } finally {
      setNormalizing(false);
      console.log('✅ Normalization complete');
    }
  };

  const handleDownloadNormalized = () => {
    if (normalizedCSV && file) {
      const filename = file.name.replace('.csv', '_normalized.csv');
      downloadCSV(normalizedCSV, filename);
    }
  };

  const calculatePnL = (trade: ParsedTrade) => {
    if (!trade.exit_price) return { pnl: 0, pnl_percentage: 0 };

    let pnl = 0;
    if (trade.trade_type === 'long') {
      pnl = (trade.exit_price - trade.entry_price) * trade.quantity - trade.fees;
    } else {
      pnl = (trade.entry_price - trade.exit_price) * trade.quantity - trade.fees;
    }

    const pnl_percentage = (pnl / (trade.entry_price * trade.quantity)) * 100;
    return { pnl, pnl_percentage };
  };

  const handleImport = async () => {
    console.log('🚀 Import button clicked');
    console.log('📊 Preview length:', preview.length);
    console.log('👤 User ID:', user?.id);
    console.log('💼 Account ID:', accountId || 'None');

    if (preview.length === 0) {
      const errorMsg = 'No trades to import';
      console.error('❌', errorMsg);
      setError(errorMsg);
      return;
    }

    setLoading(true);
    setError('');
    console.log('⏳ Starting import of', preview.length, 'trades...');

    try {
      const tradesToInsert = preview.map((trade, index) => {
        const { pnl, pnl_percentage } = calculatePnL(trade);
        const tradeData = {
          user_id: user!.id,
          account_id: accountId || null,
          ...trade,
          status: trade.exit_price ? 'closed' : 'open',
          pnl,
          pnl_percentage,
        };
        console.log(`  Trade ${index + 1}:`, {
          symbol: trade.symbol,
          type: trade.trade_type,
          entry: trade.entry_price,
          exit: trade.exit_price,
          pnl: pnl.toFixed(2)
        });
        return tradeData;
      });

      console.log('⏳ Inserting trades into Supabase...');
      const { data, error: insertError } = await supabase
        .from('trades')
        .insert(tradesToInsert)
        .select();

      if (insertError) {
        console.error('❌ Supabase insert error:', insertError);
        throw insertError;
      }

      console.log('✅ Trades inserted successfully:', data?.length || tradesToInsert.length);
      const successMsg = `Successfully imported ${preview.length} trades!`;
      console.log('✅', successMsg);
      setSuccess(successMsg);

      console.log('⏳ Waiting 1.5s before closing modal...');
      setTimeout(() => {
        console.log('✅ Calling onSuccess callback');
        onSuccess();
        console.log('✅ Closing modal');
        onClose();
      }, 1500);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error importing trades';
      console.error('❌ Import error:', errorMsg, err);
      setError(errorMsg);
    } finally {
      setLoading(false);
      console.log('✅ Import process complete');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between z-10">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <Upload className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Import Trades from CSV</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Auto-normalize any broker format</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 px-4 py-3 rounded-lg flex items-center space-x-2">
              <CheckCircle className="w-5 h-5" />
              <span>{success}</span>
            </div>
          )}

          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2 flex items-center space-x-2">
              <Sparkles className="w-5 h-5" />
              <span>Smart CSV Normalization</span>
            </h3>
            <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
              <li>• Automatically detects and converts NinjaTrader, TopStep, Tradovate, Interactive Brokers formats</li>
              <li>• Maps alternate column names (Symbol → ContractName, Qty → Size, Buy/Sell → Side)</li>
              <li>• Normalizes dates to ISO format (YYYY-MM-DD HH:mm:ss)</li>
              <li>• Fills missing columns with defaults (Status = Filled, Type = Market)</li>
              <li>• Pairs Opening and Closing orders to create complete trades</li>
            </ul>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Account (Optional)
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">No Account (Manual Trades)</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.account_name} ({account.broker_name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Upload CSV File
            </label>
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {normalizing ? (
                    <>
                      <RefreshCw className="w-10 h-10 mb-3 text-emerald-500 animate-spin" />
                      <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                        Normalizing CSV...
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 mb-3 text-gray-400" />
                      <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">CSV files from any broker</p>
                      {file && (
                        <div className="mt-2 flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{file.name}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".csv"
                  onChange={handleFileChange}
                  disabled={normalizing}
                />
              </label>
            </div>
          </div>

          {normalizationStats && (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Normalization Summary</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Rows Processed</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{normalizationStats.rowsProcessed}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Columns Matched</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{normalizationStats.columnsMatched}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Broker Format</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white capitalize">{normalizationStats.broker}</p>
                </div>
              </div>
              <button
                onClick={handleDownloadNormalized}
                className="mt-3 flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                <Download className="w-4 h-4" />
                <span>Download Normalized CSV</span>
              </button>
            </div>
          )}

          {preview.length === 0 && file && !normalizing && !error && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-5 h-5" />
              <span>CSV processed but no valid trades found. Please check your file format.</span>
            </div>
          )}

          {preview.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Preview ({preview.length} trades)
              </h3>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Symbol</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Type</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Entry</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Exit</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Qty</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">P&L</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {preview.slice(0, 10).map((trade, index) => {
                        const { pnl } = calculatePnL(trade);
                        return (
                          <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                            <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{trade.symbol}</td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-1 rounded text-xs ${
                                trade.trade_type === 'long'
                                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                              }`}>
                                {trade.trade_type.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-gray-700 dark:text-gray-300">${trade.entry_price.toFixed(2)}</td>
                            <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                              {trade.exit_price ? `$${trade.exit_price.toFixed(2)}` : '-'}
                            </td>
                            <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{trade.quantity}</td>
                            <td className={`px-4 py-2 font-semibold ${pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                              {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {preview.length > 10 && (
                  <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 text-sm text-gray-600 dark:text-gray-400 text-center">
                    Showing 10 of {preview.length} trades
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              onClick={handleImport}
              disabled={loading || preview.length === 0 || normalizing}
              title={preview.length === 0 ? 'Please upload a CSV file first' : normalizing ? 'Processing CSV...' : loading ? 'Import in progress...' : `Click to import ${preview.length} trades`}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading && <RefreshCw className="w-5 h-5 animate-spin" />}
              <span>{loading ? 'Importing...' : preview.length > 0 ? `Import ${preview.length} Trades` : 'Import Trades'}</span>
            </button>
            <button
              onClick={onClose}
              disabled={loading || normalizing}
              className="px-6 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold py-3 rounded-lg transition disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
