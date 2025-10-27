import { useState, useEffect } from 'react';
import { supabase, BrokerAccount } from '../lib/supabase';
import { X, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

interface ApiConfigModalProps {
  account: BrokerAccount;
  onClose: () => void;
  onSave: () => void;
}

export default function ApiConfigModal({ account, onClose, onSave }: ApiConfigModalProps) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    api_enabled: account.api_enabled || false,
    api_key: account.api_key || '',
    api_secret: account.api_secret || '',
    api_endpoint: account.api_endpoint || '',
    sync_enabled: account.sync_enabled || false,
    sync_frequency: account.sync_frequency || 'manual',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { error } = await supabase
        .from('broker_accounts')
        .update({
          api_enabled: formData.api_enabled,
          api_key: formData.api_key || null,
          api_secret: formData.api_secret || null,
          api_endpoint: formData.api_endpoint || null,
          sync_enabled: formData.sync_enabled,
          sync_frequency: formData.sync_frequency,
          updated_at: new Date().toISOString(),
        })
        .eq('id', account.id);

      if (error) throw error;
      setSuccess('API configuration saved successfully!');
      setTimeout(() => {
        onSave();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setError('');
    setSuccess('');
    setSyncing(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-trades`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ account_id: account.id }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Sync failed');
      }

      setSuccess(`Successfully imported ${result.trades_imported} trades!`);

      await supabase
        .from('broker_accounts')
        .update({ last_sync: new Date().toISOString() })
        .eq('id', account.id);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const getBrokerInstructions = () => {
    const broker = account.broker_name.toLowerCase();

    if (broker.includes('topstep')) {
      return {
        title: 'TopstepFX API Setup',
        steps: [
          'Log in to your TopstepFX account',
          'Navigate to Account Settings > API Access',
          'Generate a new API key with read-only permissions',
          'Copy the API key and paste it below',
        ],
        note: 'TopstepFX API keys have read-only access and cannot execute trades.',
      };
    }

    if (broker.includes('tradovate')) {
      return {
        title: 'Tradovate API Setup',
        steps: [
          'Log in to your Tradovate account',
          'Go to Settings > API Management',
          'Create a new API key',
          'Copy both the API key and secret',
        ],
        note: 'Keep your API credentials secure. Never share them with anyone.',
      };
    }

    return {
      title: 'API Setup Instructions',
      steps: [
        'Contact your broker to enable API access',
        'Generate API credentials from your broker dashboard',
        'Ensure read-only permissions are enabled',
        'Enter your credentials below',
      ],
      note: 'API credentials are encrypted and stored securely.',
    };
  };

  const instructions = getBrokerInstructions();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">API Integration</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">{instructions.title}</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 mb-2">
              {instructions.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
            <p className="text-xs text-blue-700 mt-2">{instructions.note}</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="api_enabled"
                checked={formData.api_enabled}
                onChange={(e) => setFormData({ ...formData, api_enabled: e.target.checked })}
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
              />
              <label htmlFor="api_enabled" className="ml-2 text-sm font-medium text-gray-700">
                Enable API Integration
              </label>
            </div>

            {formData.api_enabled && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={formData.api_key}
                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="Enter your API key"
                    required={formData.api_enabled}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API Secret
                  </label>
                  <input
                    type="password"
                    value={formData.api_secret}
                    onChange={(e) => setFormData({ ...formData, api_secret: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="Enter your API secret (if required)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API Endpoint
                  </label>
                  <input
                    type="url"
                    value={formData.api_endpoint}
                    onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="Custom API endpoint (optional)"
                  />
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center mb-4">
                    <input
                      type="checkbox"
                      id="sync_enabled"
                      checked={formData.sync_enabled}
                      onChange={(e) => setFormData({ ...formData, sync_enabled: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                    />
                    <label htmlFor="sync_enabled" className="ml-2 text-sm font-medium text-gray-700">
                      Enable Automatic Sync
                    </label>
                  </div>

                  {formData.sync_enabled && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sync Frequency
                      </label>
                      <select
                        value={formData.sync_frequency}
                        onChange={(e) => setFormData({ ...formData, sync_frequency: e.target.value as any })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      >
                        <option value="manual">Manual Only</option>
                        <option value="hourly">Every Hour</option>
                        <option value="daily">Once Daily</option>
                      </select>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Save Configuration'}
              </button>

              {formData.api_enabled && formData.api_key && (
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center space-x-2 px-6 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
                  <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
