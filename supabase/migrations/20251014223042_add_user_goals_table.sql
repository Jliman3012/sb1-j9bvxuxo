/*
  # Add User Goals Table

  1. New Tables
    - `user_goals`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `weekly_profit_target` (numeric, default 1000)
      - `monthly_profit_target` (numeric, default 4000)
      - `daily_win_rate_target` (numeric, default 65)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `user_goals` table
    - Add policies for authenticated users to manage their own goals

  3. Indexes
    - Add index on user_id for fast lookups
*/

-- Create user_goals table
CREATE TABLE IF NOT EXISTS user_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekly_profit_target numeric DEFAULT 1000 NOT NULL,
  monthly_profit_target numeric DEFAULT 4000 NOT NULL,
  daily_win_rate_target numeric DEFAULT 65 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT user_goals_user_id_unique UNIQUE(user_id),
  CONSTRAINT weekly_profit_positive CHECK (weekly_profit_target > 0),
  CONSTRAINT monthly_profit_positive CHECK (monthly_profit_target > 0),
  CONSTRAINT win_rate_valid CHECK (daily_win_rate_target >= 0 AND daily_win_rate_target <= 100)
);

-- Add index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_user_goals_user_id ON user_goals(user_id);

-- Enable RLS
ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own goals"
  ON user_goals FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own goals"
  ON user_goals FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own goals"
  ON user_goals FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own goals"
  ON user_goals FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS user_goals_updated_at ON user_goals;
CREATE TRIGGER user_goals_updated_at
  BEFORE UPDATE ON user_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_user_goals_updated_at();
