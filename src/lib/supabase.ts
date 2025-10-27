import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: {
      getItem: (key: string) => {
        const persistSession = localStorage.getItem('keepMeSignedIn') === 'true';
        if (persistSession) {
          return localStorage.getItem(key);
        }
        return sessionStorage.getItem(key);
      },
      setItem: (key: string, value: string) => {
        const persistSession = localStorage.getItem('keepMeSignedIn') === 'true';
        if (persistSession) {
          localStorage.setItem(key, value);
        } else {
          sessionStorage.setItem(key, value);
        }
      },
      removeItem: (key: string) => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      },
    },
  },
});

export type Profile = {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
};

export type UserGoals = {
  id: string;
  user_id: string;
  weekly_profit_target: number;
  monthly_profit_target: number;
  daily_win_rate_target: number;
  created_at: string;
  updated_at: string;
};

export type BrokerAccount = {
  id: string;
  user_id: string;
  account_name: string;
  account_type: 'broker' | 'propfirm' | 'crypto_wallet';
  broker_name: string;
  account_number?: string;
  balance: number;
  currency: string;
  api_enabled: boolean;
  api_key?: string;
  api_secret?: string;
  api_endpoint?: string;
  last_sync?: string;
  sync_enabled: boolean;
  sync_frequency: 'manual' | 'hourly' | 'daily';
  created_at: string;
  updated_at: string;
};

export type SyncLog = {
  id: string;
  account_id: string;
  user_id: string;
  sync_status: 'success' | 'error' | 'partial';
  trades_imported: number;
  error_message?: string;
  started_at: string;
  completed_at?: string;
};

export type Trade = {
  id: string;
  user_id: string;
  account_id: string;
  symbol: string;
  trade_type: 'long' | 'short';
  entry_date: string;
  exit_date?: string;
  entry_price: number;
  exit_price?: number;
  quantity: number;
  pnl: number;
  pnl_percentage: number;
  fees: number;
  status: 'open' | 'closed';
  notes?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
};

export type Instrument = {
  id: string;
  symbol: string;
  name: string;
  instrument_type: 'futures' | 'crypto' | 'forex' | 'metals';
  tick_size: number;
  contract_size: number;
  currency: string;
  created_at: string;
};

export type Strategy = {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  strategy_type: 'trend_following' | 'mean_reversion' | 'breakout' | 'custom';
  entry_rules: Record<string, any>;
  exit_rules: Record<string, any>;
  risk_management: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type Backtest = {
  id: string;
  user_id: string;
  strategy_id: string;
  instrument_id: string;
  name: string;
  start_date: string;
  end_date: string;
  initial_capital: number;
  timeframe: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  total_pnl: number;
  win_rate: number;
  profit_factor: number;
  max_drawdown: number;
  sharpe_ratio: number;
  results?: Record<string, any>;
  created_at: string;
  completed_at?: string;
};
