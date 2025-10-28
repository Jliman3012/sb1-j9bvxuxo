-- Add gamification events table for XP tracking and extend trade replay metadata

-- Create gamification_events table if it does not already exist
CREATE TABLE IF NOT EXISTS gamification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  xp_value integer NOT NULL DEFAULT 0,
  reference_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gamification_events_user_id ON gamification_events(user_id);
CREATE INDEX IF NOT EXISTS idx_gamification_events_event_type ON gamification_events(event_type);

-- Ensure RLS is enabled with basic ownership policies
ALTER TABLE gamification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view own gamification events"
  ON gamification_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert own gamification events"
  ON gamification_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update own gamification events"
  ON gamification_events FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete own gamification events"
  ON gamification_events FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Avoid duplicate rewards for the same reference by enforcing uniqueness when reference_id is provided
CREATE UNIQUE INDEX IF NOT EXISTS uniq_gamification_events_reference
  ON gamification_events(user_id, event_type, reference_id)
  WHERE reference_id IS NOT NULL;

-- Extend trade_replays with a data source tag for analytics
ALTER TABLE trade_replays
  ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'synthetic';

CREATE INDEX IF NOT EXISTS idx_trade_replays_data_source ON trade_replays(data_source);
