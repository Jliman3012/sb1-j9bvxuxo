import { useEffect, useState } from 'react';
import { supabase, BrokerAccount } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Wallet, Building, Landmark, Trash2, Settings, CheckCircle, RefreshCw } from 'lucide-react';
import ApiConfigModal from './ApiConfigModal';
import SyncHistory from './SyncHistory';

interface AccountsProps {
  onNavigate: (page: string) => void;
}

export default function Accounts({ onNavigate }: AccountsProps) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<BrokerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<BrokerAccount | null>(null);

  useEffect(() => {
    if (user) {
      loadAccounts();
    }
  }, [user]);

  const loadAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('broker_accounts')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async (id: string) => {
    if (!confirm('Are you sure you want to delete this account? This will also delete all associated trades.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('broker_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
    }
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'broker':
        return <Building className="w-6 h-6" />;
      case 'propfirm':
        return <Landmark className="w-6 h-6" />;
      case 'crypto_wallet':
        return <Wallet className="w-6 h-6" />;
      default:
        return <Wallet className="w-6 h-6" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {accounts.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-200 text-center">
          <Wallet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Accounts Yet</h3>
          <p className="text-gray-500 mb-6">Add your first broker account to start tracking trades.</p>
          <button
            onClick={() => onNavigate('add-account')}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg transition font-medium"
          >
            Add Your First Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-lg bg-emerald-100 text-emerald-600">
                  {getAccountIcon(account.account_type)}
                </div>
                <button
                  onClick={() => deleteAccount(account.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Delete account"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {account.account_name}
              </h3>
              <p className="text-sm text-gray-600 mb-4">{account.broker_name}</p>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Type</span>
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {account.account_type.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Balance</span>
                  <span className="text-sm font-semibold text-gray-900">
                    ${Number(account.balance).toLocaleString()} {account.currency}
                  </span>
                </div>
                {account.account_number && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Account #</span>
                    <span className="text-sm font-mono text-gray-900">
                      {account.account_number}
                    </span>
                  </div>
                )}
              </div>

              {account.api_enabled && (
                <div className="mb-4 pb-4 border-b border-gray-200">
                  <div className="flex items-center space-x-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-600 font-medium">API Connected</span>
                  </div>
                  {account.last_sync && (
                    <p className="text-xs text-gray-500 mt-1">
                      Last sync: {new Date(account.last_sync).toLocaleString()}
                    </p>
                  )}
                  {account.sync_enabled && (
                    <div className="flex items-center space-x-1 mt-1">
                      <RefreshCw className="w-3 h-3 text-blue-600" />
                      <span className="text-xs text-blue-600">Auto-sync: {account.sync_frequency}</span>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => setSelectedAccount(account)}
                className="w-full flex items-center justify-center space-x-2 bg-slate-100 hover:bg-slate-200 text-gray-700 py-2 rounded-lg transition text-sm font-medium"
              >
                <Settings className="w-4 h-4" />
                <span>{account.api_enabled ? 'Manage API' : 'Setup API'}</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedAccount && (
        <ApiConfigModal
          account={selectedAccount}
          onClose={() => setSelectedAccount(null)}
          onSave={() => {
            loadAccounts();
            setSelectedAccount(null);
          }}
        />
      )}

      {accounts.some(a => a.api_enabled) && (
        <div className="mt-8">
          <SyncHistory />
        </div>
      )}
    </div>
  );
}
