import { useEffect, useState } from 'react';
import { supabase, Trade } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, TrendingUp, TrendingDown, Award, FileText, Download } from 'lucide-react';
import { generateWeeklyReport, exportReportAsText, WeeklyReport as WeeklyReportType } from '../lib/reportGenerator';

export default function WeeklyReport() {
  const { user } = useAuth();
  const [report, setReport] = useState<WeeklyReportType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadReport();
    }
  }, [user]);

  const loadReport = async () => {
    try {
      const { data } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user!.id);

      if (data) {
        const weeklyReport = generateWeeklyReport(data);
        setReport(weeklyReport);
      }
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (!report) return;

    const text = exportReportAsText(report);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weekly-report-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!report || report.totalTrades === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-12 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
        <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Weekly Data</h3>
        <p className="text-gray-500 dark:text-gray-400">Complete some trades this week to generate your report.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <Calendar className="w-6 h-6" />
              <h2 className="text-2xl font-bold">Weekly Report</h2>
            </div>
            <p className="text-white/90">{report.period}</p>
          </div>
          <button
            onClick={downloadReport}
            className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Trades</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{report.totalTrades}</p>
          </div>
          <div className="bg-slate-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Win Rate</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{report.winRate.toFixed(1)}%</p>
          </div>
          <div className="bg-slate-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total P&L</p>
            <p className={`text-2xl font-bold ${report.totalPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              ${report.totalPnL.toFixed(2)}
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Profit Factor</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{report.profitFactor.toFixed(2)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 text-emerald-600 mr-2" />
              Best Performers
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Best Day</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{report.bestDay.date}</p>
                </div>
                <p className="text-lg font-bold text-emerald-600">${report.bestDay.pnl.toFixed(2)}</p>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Best Trade</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{report.bestTrade.symbol}</p>
                </div>
                <p className="text-lg font-bold text-blue-600">${report.bestTrade.pnl.toFixed(2)}</p>
              </div>
              <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Top Symbol</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{report.topSymbol.symbol}</p>
                </div>
                <p className="text-lg font-bold text-purple-600">${report.topSymbol.pnl.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <TrendingDown className="w-5 h-5 text-red-600 mr-2" />
              Areas to Improve
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Worst Day</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{report.worstDay.date}</p>
                </div>
                <p className="text-lg font-bold text-red-600">${report.worstDay.pnl.toFixed(2)}</p>
              </div>
              <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Worst Trade</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{report.worstTrade.symbol}</p>
                </div>
                <p className="text-lg font-bold text-orange-600">${report.worstTrade.pnl.toFixed(2)}</p>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Avg Hold Time</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{report.avgHoldTime.toFixed(1)} hours</p>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Consistency: {report.consistency}</p>
              </div>
            </div>
          </div>
        </div>

        {report.insights.length > 0 && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Award className="w-6 h-6 text-amber-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Key Insights</h3>
            </div>
            <ul className="space-y-2">
              {report.insights.map((insight, i) => (
                <li key={i} className="text-gray-700 dark:text-gray-300">{insight}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
