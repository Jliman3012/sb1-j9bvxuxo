/*
  # Make account_id optional for trades

  1. Changes
    - Alter trades table to make account_id nullable
    - This allows users to import trades without requiring a broker account
    - Users can optionally link trades to accounts later

  2. Security
    - No changes to RLS policies
    - Users can still only access their own trades
*/

-- Make account_id optional in trades table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'account_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE trades ALTER COLUMN account_id DROP NOT NULL;
  END IF;
END $$;
