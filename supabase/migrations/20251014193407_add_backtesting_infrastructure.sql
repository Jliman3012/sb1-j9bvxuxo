/*
  # Add Backtesting Infrastructure

  1. New Tables
    - `instruments`
      - `id` (uuid, primary key)
      - `symbol` (text, unique) - NQ, ES, BTC, ETH, XRP, SOL, XAU, EURUSD, etc.
      - `name` (text) - Full name
      - `instrument_type` (text) - futures, crypto, forex, metals
      - `tick_size` (decimal) - Minimum price movement
      - `contract_size` (decimal) - Size of one contract/lot
      - `currency` (text) - Quote currency
      - `created_at` (timestamptz)
    
    - `market_data`
      - `id` (uuid, primary key)
      - `instrument_id` (uuid, references instruments)
      - `timestamp` (timestamptz) - Bar timestamp
      - `open` (decimal)
      - `high` (decimal)
      - `low` (decimal)
      - `close` (decimal)
      - `volume` (bigint)
      - `timeframe` (text) - 1m, 5m, 15m, 1h, 4h, 1d
    
    - `strategies`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `name` (text)
      - `description` (text)
      - `strategy_type` (text) - trend_following, mean_reversion, breakout, custom
      - `entry_rules` (jsonb) - Entry conditions
      - `exit_rules` (jsonb) - Exit conditions
      - `risk_management` (jsonb) - Position sizing, stop loss, take profit
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `backtests`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `strategy_id` (uuid, references strategies)
      - `instrument_id` (uuid, references instruments)
      - `name` (text)
      - `start_date` (date)
      - `end_date` (date)
      - `initial_capital` (decimal)
      - `timeframe` (text)
      - `status` (text) - pending, running, completed, failed
      - `total_trades` (integer)
      - `winning_trades` (integer)
      - `losing_trades` (integer)
      - `total_pnl` (decimal)
      - `win_rate` (decimal)
      - `profit_factor` (decimal)
      - `max_drawdown` (decimal)
      - `sharpe_ratio` (decimal)
      - `results` (jsonb) - Detailed trade-by-trade results
      - `created_at` (timestamptz)
      - `completed_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Public read access for instruments and market_data
    - Users can only manage their own strategies and backtests

  3. Important Notes
    - Market data is shared across all users
    - Strategies are private to each user
    - Backtests store comprehensive results for analysis
*/

-- Create instruments table
CREATE TABLE IF NOT EXISTS instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text UNIQUE NOT NULL,
  name text NOT NULL,
  instrument_type text NOT NULL CHECK (instrument_type IN ('futures', 'crypto', 'forex', 'metals')),
  tick_size decimal(15, 8) NOT NULL,
  contract_size decimal(15, 4) NOT NULL,
  currency text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE instruments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view instruments"
  ON instruments FOR SELECT
  TO authenticated
  USING (true);

-- Create market_data table
CREATE TABLE IF NOT EXISTS market_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL,
  open decimal(15, 8) NOT NULL,
  high decimal(15, 8) NOT NULL,
  low decimal(15, 8) NOT NULL,
  close decimal(15, 8) NOT NULL,
  volume bigint DEFAULT 0,
  timeframe text NOT NULL CHECK (timeframe IN ('1m', '5m', '15m', '1h', '4h', '1d'))
);

ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view market data"
  ON market_data FOR SELECT
  TO authenticated
  USING (true);

-- Create strategies table
CREATE TABLE IF NOT EXISTS strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  strategy_type text NOT NULL CHECK (strategy_type IN ('trend_following', 'mean_reversion', 'breakout', 'custom')),
  entry_rules jsonb NOT NULL,
  exit_rules jsonb NOT NULL,
  risk_management jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own strategies"
  ON strategies FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own strategies"
  ON strategies FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own strategies"
  ON strategies FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own strategies"
  ON strategies FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create backtests table
CREATE TABLE IF NOT EXISTS backtests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  strategy_id uuid NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
  instrument_id uuid NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  initial_capital decimal(15, 2) NOT NULL,
  timeframe text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  total_trades integer DEFAULT 0,
  winning_trades integer DEFAULT 0,
  losing_trades integer DEFAULT 0,
  total_pnl decimal(15, 2) DEFAULT 0,
  win_rate decimal(5, 2) DEFAULT 0,
  profit_factor decimal(10, 4) DEFAULT 0,
  max_drawdown decimal(15, 2) DEFAULT 0,
  sharpe_ratio decimal(10, 4) DEFAULT 0,
  results jsonb,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE backtests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own backtests"
  ON backtests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own backtests"
  ON backtests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own backtests"
  ON backtests FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own backtests"
  ON backtests FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Insert popular instruments
INSERT INTO instruments (symbol, name, instrument_type, tick_size, contract_size, currency) VALUES
  ('NQ', 'E-mini NASDAQ-100', 'futures', 0.25, 20, 'USD'),
  ('ES', 'E-mini S&P 500', 'futures', 0.25, 50, 'USD'),
  ('BTCUSD', 'Bitcoin', 'crypto', 0.01, 1, 'USD'),
  ('ETHUSD', 'Ethereum', 'crypto', 0.01, 1, 'USD'),
  ('XRPUSD', 'Ripple', 'crypto', 0.0001, 1, 'USD'),
  ('SOLUSD', 'Solana', 'crypto', 0.01, 1, 'USD'),
  ('XAUUSD', 'Gold', 'metals', 0.01, 100, 'USD'),
  ('EURUSD', 'Euro/US Dollar', 'forex', 0.00001, 100000, 'USD'),
  ('GBPUSD', 'British Pound/US Dollar', 'forex', 0.00001, 100000, 'USD'),
  ('USDJPY', 'US Dollar/Japanese Yen', 'forex', 0.001, 100000, 'JPY')
ON CONFLICT (symbol) DO NOTHING;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_market_data_instrument ON market_data(instrument_id);
CREATE INDEX IF NOT EXISTS idx_market_data_timestamp ON market_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_market_data_timeframe ON market_data(timeframe);
CREATE INDEX IF NOT EXISTS idx_market_data_lookup ON market_data(instrument_id, timeframe, timestamp);
CREATE INDEX IF NOT EXISTS idx_strategies_user ON strategies(user_id);
CREATE INDEX IF NOT EXISTS idx_backtests_user ON backtests(user_id);
CREATE INDEX IF NOT EXISTS idx_backtests_strategy ON backtests(strategy_id);
CREATE INDEX IF NOT EXISTS idx_backtests_status ON backtests(status);