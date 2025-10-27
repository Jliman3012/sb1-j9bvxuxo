import { useEffect, useState } from 'react';
import { supabase, SyncLog, BrokerAccount } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';

interface SyncHistoryProps {
  accountId?: string;
}

export default function SyncHistory({ accountId }: SyncHistoryProps) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<(SyncLog & { account: BrokerAccount })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadLogs();
    }
  }, [user, accountId]);

  const loadLogs = async () => {
    try {
      let query = supabase
        .from('sync_logs')
        .select('*, broker_accounts!inner(*)')
        .eq('user_id', user!.id)
        .order('started_at', { ascending: false })
        .limit(20);

      if (accountId) {
        query = query.eq('account_id', accountId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedData = data.map((log: any) => ({
        ...log,
        account: log.broker_accounts,
      }));

      setLogs(formattedData as any);
    } catch (error) {
      console.error('Error loading sync logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-emerald-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'partial':
        return <AlertCircle className="w-5 h-5 text-amber-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'error':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'partial':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 text-center">
        <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-500">No sync history available yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Sync History</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {logs.map((log) => (
          <div key={log.id} className="p-6 hover:bg-slate-50 transition">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div className="mt-1">{getStatusIcon(log.sync_status)}</div>
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-semibold text-gray-900">
                      {log.account.account_name}
                    </span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                        log.sync_status
                      )}`}
                    >
                      {log.sync_status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">
                    {log.account.broker_name}
                  </p>
                  <p className="text-sm text-gray-900">
                    <span className="font-medium">{log.trades_imported}</span> trades imported
                  </p>
                  {log.error_message && (
                    <p className="text-sm text-red-600 mt-2">
                      Error: {log.error_message}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">
                  {new Date(log.started_at).toLocaleString()}
                </p>
                {log.completed_at && (
                  <p className="text-xs text-gray-500 mt-1">
                    Duration:{' '}
                    {(
                      (new Date(log.completed_at).getTime() -
                        new Date(log.started_at).getTime()) /
                      1000
                    ).toFixed(1)}
                    s
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
