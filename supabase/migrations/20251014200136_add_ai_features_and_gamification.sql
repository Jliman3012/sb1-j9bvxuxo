/*
  # AI-Powered Trading Journal Enhancement

  1. New Tables
    - `trade_emotions`
      - Tracks pre-trade and post-trade emotional states
      - Links emotions to trade performance
    
    - `discipline_logs`
      - Records rule-following and violations
      - Calculates discipline scores
    
    - `ai_insights`
      - Stores AI-generated performance summaries
      - Tracks behavior patterns and recommendations
    
    - `gamification`
      - Streaks, badges, levels, and achievements
      - User progression tracking
    
    - `trader_profiles`
      - AI-generated psychological profiles
      - Trading style and behavior analysis
    
    - `pattern_detection`
      - Identified successful trade setups
      - Optimal trading conditions per user
    
    - `performance_forecasts`
      - AI predictions for future performance
      - Probability calculations

  2. Changes to Existing Tables
    - Add emotion and discipline fields to trades table
    - Add performance metrics tracking

  3. Security
    - Enable RLS on all new tables
    - Restrict access to user's own data
*/

-- Add emotion tracking to trades
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'pre_trade_emotion'
  ) THEN
    ALTER TABLE trades ADD COLUMN pre_trade_emotion text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'post_trade_emotion'
  ) THEN
    ALTER TABLE trades ADD COLUMN post_trade_emotion text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'emotional_state'
  ) THEN
    ALTER TABLE trades ADD COLUMN emotional_state jsonb DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'rule_violations'
  ) THEN
    ALTER TABLE trades ADD COLUMN rule_violations text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'setup_type'
  ) THEN
    ALTER TABLE trades ADD COLUMN setup_type text;
  END IF;
END $$;

-- Trade emotions detailed tracking
CREATE TABLE IF NOT EXISTS trade_emotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trade_id uuid NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  emotion_type text NOT NULL CHECK (emotion_type IN ('pre_trade', 'post_trade')),
  mood text NOT NULL,
  confidence_level integer CHECK (confidence_level BETWEEN 1 AND 10),
  stress_level integer CHECK (stress_level BETWEEN 1 AND 10),
  clarity_level integer CHECK (clarity_level BETWEEN 1 AND 10),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE trade_emotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own emotions"
  ON trade_emotions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own emotions"
  ON trade_emotions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own emotions"
  ON trade_emotions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own emotions"
  ON trade_emotions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Discipline tracking
CREATE TABLE IF NOT EXISTS discipline_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trade_id uuid REFERENCES trades(id) ON DELETE CASCADE,
  log_date date DEFAULT CURRENT_DATE,
  rule_name text NOT NULL,
  rule_followed boolean NOT NULL,
  violation_type text,
  impact_level integer CHECK (impact_level BETWEEN 1 AND 5),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE discipline_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own discipline logs"
  ON discipline_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own discipline logs"
  ON discipline_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own discipline logs"
  ON discipline_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own discipline logs"
  ON discipline_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- AI insights
CREATE TABLE IF NOT EXISTS ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  insight_type text NOT NULL CHECK (insight_type IN ('daily_summary', 'weekly_summary', 'pattern_detected', 'recommendation', 'warning', 'milestone')),
  title text NOT NULL,
  content text NOT NULL,
  data jsonb DEFAULT '{}',
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insights"
  ON ai_insights FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own insights"
  ON ai_insights FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Gamification system
CREATE TABLE IF NOT EXISTS gamification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  current_level integer DEFAULT 1,
  total_xp integer DEFAULT 0,
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  last_trade_date date,
  badges jsonb DEFAULT '[]',
  achievements jsonb DEFAULT '[]',
  discipline_score integer DEFAULT 50 CHECK (discipline_score BETWEEN 0 AND 100),
  consistency_score integer DEFAULT 50 CHECK (consistency_score BETWEEN 0 AND 100),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE gamification ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gamification"
  ON gamification FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gamification"
  ON gamification FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gamification"
  ON gamification FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trader profiles (AI-generated)
CREATE TABLE IF NOT EXISTS trader_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trading_style text,
  risk_tolerance text,
  best_time_ranges text[],
  best_instruments text[],
  psychological_traits jsonb DEFAULT '{}',
  strengths text[],
  weaknesses text[],
  optimal_conditions text,
  personality_summary text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE trader_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON trader_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON trader_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON trader_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Pattern detection
CREATE TABLE IF NOT EXISTS pattern_detection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pattern_name text NOT NULL,
  pattern_type text NOT NULL CHECK (pattern_type IN ('setup', 'time', 'behavior', 'market_condition')),
  win_rate decimal(5, 2),
  avg_pnl decimal(15, 2),
  trade_count integer DEFAULT 0,
  conditions jsonb DEFAULT '{}',
  recommendation text,
  confidence_score decimal(5, 2),
  last_detected_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pattern_detection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own patterns"
  ON pattern_detection FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own patterns"
  ON pattern_detection FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own patterns"
  ON pattern_detection FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own patterns"
  ON pattern_detection FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Performance forecasts
CREATE TABLE IF NOT EXISTS performance_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  forecast_period text NOT NULL CHECK (forecast_period IN ('daily', 'weekly', 'monthly')),
  forecast_date date NOT NULL,
  predicted_win_rate decimal(5, 2),
  predicted_pnl decimal(15, 2),
  confidence_level decimal(5, 2),
  factors jsonb DEFAULT '{}',
  recommendations text[],
  created_at timestamptz DEFAULT now()
);

ALTER TABLE performance_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own forecasts"
  ON performance_forecasts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Trading rules
CREATE TABLE IF NOT EXISTS trading_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rule_name text NOT NULL,
  rule_description text NOT NULL,
  rule_type text NOT NULL CHECK (rule_type IN ('risk_management', 'entry', 'exit', 'time', 'emotional', 'position_sizing')),
  is_active boolean DEFAULT true,
  violation_count integer DEFAULT 0,
  last_violated_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE trading_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rules"
  ON trading_rules FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rules"
  ON trading_rules FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rules"
  ON trading_rules FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own rules"
  ON trading_rules FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_trade_emotions_user_trade ON trade_emotions(user_id, trade_id);
CREATE INDEX IF NOT EXISTS idx_discipline_logs_user_date ON discipline_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_ai_insights_user_type ON ai_insights(user_id, insight_type);
CREATE INDEX IF NOT EXISTS idx_ai_insights_unread ON ai_insights(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_pattern_detection_user ON pattern_detection(user_id);
CREATE INDEX IF NOT EXISTS idx_performance_forecasts_user_date ON performance_forecasts(user_id, forecast_date);
CREATE INDEX IF NOT EXISTS idx_trading_rules_user_active ON trading_rules(user_id, is_active) WHERE is_active = true;
