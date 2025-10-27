/*
  # Advanced Trading Journal Features Schema

  1. New Tables
    - `journal_templates` - Custom journal entry templates
    - `learning_progress` - Track educational resource completion
    - `shared_journals` - Public journal sharing
    - `trade_replays` - Trade replay tick data and insights

  2. Table Modifications
    - Add `r_multiple`, `stop_price`, `journal_data`, `replay_reviewed` to trades

  3. Security
    - Enable RLS on all new tables with user-scoped policies
*/

-- Add new columns to trades table
ALTER TABLE trades ADD COLUMN IF NOT EXISTS r_multiple NUMERIC;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS stop_price NUMERIC;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS journal_data JSONB;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS replay_reviewed BOOLEAN DEFAULT false;

-- Create journal_templates table
CREATE TABLE IF NOT EXISTS journal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE journal_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own templates"
  ON journal_templates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own templates"
  ON journal_templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates"
  ON journal_templates FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
  ON journal_templates FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create learning_progress table
CREATE TABLE IF NOT EXISTS learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('video', 'quiz', 'article')),
  resource_id TEXT NOT NULL,
  resource_title TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  score INTEGER,
  xp_earned INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, resource_id)
);

ALTER TABLE learning_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress"
  ON learning_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own progress"
  ON learning_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON learning_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create shared_journals table
CREATE TABLE IF NOT EXISTS shared_journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  display_name TEXT NOT NULL,
  redacted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  views INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE shared_journals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own shared journal"
  ON shared_journals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Public can view public journals"
  ON shared_journals FOR SELECT
  TO authenticated
  USING (is_public = true);

CREATE POLICY "Users can create own shared journal"
  ON shared_journals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shared journal"
  ON shared_journals FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own shared journal"
  ON shared_journals FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create trade_replays table
CREATE TABLE IF NOT EXISTS trade_replays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID REFERENCES trades(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tick_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  replay_insights TEXT,
  times_viewed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(trade_id)
);

ALTER TABLE trade_replays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own replays"
  ON trade_replays FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own replays"
  ON trade_replays FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own replays"
  ON trade_replays FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_journal_templates_user_id ON journal_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_user_id ON learning_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_journals_is_public ON shared_journals(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_trade_replays_trade_id ON trade_replays(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_replays_user_id ON trade_replays(user_id);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_journal_templates_updated_at ON journal_templates;
CREATE TRIGGER update_journal_templates_updated_at
  BEFORE UPDATE ON journal_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shared_journals_updated_at ON shared_journals;
CREATE TRIGGER update_shared_journals_updated_at
  BEFORE UPDATE ON shared_journals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
