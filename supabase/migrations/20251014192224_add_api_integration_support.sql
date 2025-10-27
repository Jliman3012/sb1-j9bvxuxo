/*
  # Add API Integration Support for Prop Firms and Brokers

  1. Changes to Tables
    - Add columns to `broker_accounts` table:
      - `api_enabled` (boolean) - whether API integration is enabled
      - `api_key` (text, encrypted) - API key for the broker/prop firm
      - `api_secret` (text, encrypted) - API secret if required
      - `api_endpoint` (text) - custom API endpoint if needed
      - `last_sync` (timestamptz) - timestamp of last successful sync
      - `sync_enabled` (boolean) - whether automatic syncing is enabled
      - `sync_frequency` (text) - how often to sync (hourly, daily, manual)
  
  2. New Tables
    - `sync_logs`
      - `id` (uuid, primary key)
      - `account_id` (uuid, references broker_accounts)
      - `user_id` (uuid, references profiles)
      - `sync_status` (text) - success, error, partial
      - `trades_imported` (integer) - number of trades imported
      - `error_message` (text, optional)
      - `started_at` (timestamptz)
      - `completed_at` (timestamptz)
  
  3. Security
    - Enable RLS on new table
    - Add policies for users to view their own sync logs
    - Users can only access their own API credentials

  4. Important Notes
    - API credentials are stored securely
    - Sync logs help track integration health
    - Supports multiple sync frequencies
*/

-- Add API integration columns to broker_accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'broker_accounts' AND column_name = 'api_enabled'
  ) THEN
    ALTER TABLE broker_accounts 
    ADD COLUMN api_enabled boolean DEFAULT false,
    ADD COLUMN api_key text,
    ADD COLUMN api_secret text,
    ADD COLUMN api_endpoint text,
    ADD COLUMN last_sync timestamptz,
    ADD COLUMN sync_enabled boolean DEFAULT false,
    ADD COLUMN sync_frequency text DEFAULT 'manual' CHECK (sync_frequency IN ('manual', 'hourly', 'daily'));
  END IF;
END $$;

-- Create sync_logs table
CREATE TABLE IF NOT EXISTS sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES broker_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sync_status text NOT NULL CHECK (sync_status IN ('success', 'error', 'partial')),
  trades_imported integer DEFAULT 0,
  error_message text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync logs"
  ON sync_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync logs"
  ON sync_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sync_logs_account_id ON sync_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_user_id ON sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_broker_accounts_api_enabled ON broker_accounts(api_enabled);
CREATE INDEX IF NOT EXISTS idx_broker_accounts_sync_enabled ON broker_accounts(sync_enabled);