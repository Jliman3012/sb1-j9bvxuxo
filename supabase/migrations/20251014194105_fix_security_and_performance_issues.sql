/*
  # Fix Security and Performance Issues

  1. Add Missing Indexes
    - Add index for backtests_instrument_id foreign key
    - Add index for trade_screenshots_user_id foreign key
  
  2. Optimize RLS Policies
    - Update all auth.uid() calls to (select auth.uid())
    - This prevents re-evaluation for each row and improves performance
  
  3. Tables Affected
    - profiles
    - broker_accounts
    - trades
    - trade_screenshots
    - sync_logs
    - strategies
    - backtests

  Note: Unused index warnings are expected for new features and will be used as data grows.
  Leaked password protection is a Supabase dashboard setting, not a migration concern.
*/

-- Add missing indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_backtests_instrument_id ON backtests(instrument_id);
CREATE INDEX IF NOT EXISTS idx_trade_screenshots_user_id ON trade_screenshots(user_id);

-- ============================================================================
-- PROFILES TABLE - Optimize RLS Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

-- ============================================================================
-- BROKER_ACCOUNTS TABLE - Optimize RLS Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own accounts" ON broker_accounts;
CREATE POLICY "Users can view own accounts"
  ON broker_accounts FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own accounts" ON broker_accounts;
CREATE POLICY "Users can insert own accounts"
  ON broker_accounts FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own accounts" ON broker_accounts;
CREATE POLICY "Users can update own accounts"
  ON broker_accounts FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own accounts" ON broker_accounts;
CREATE POLICY "Users can delete own accounts"
  ON broker_accounts FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- TRADES TABLE - Optimize RLS Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own trades" ON trades;
CREATE POLICY "Users can view own trades"
  ON trades FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own trades" ON trades;
CREATE POLICY "Users can insert own trades"
  ON trades FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own trades" ON trades;
CREATE POLICY "Users can update own trades"
  ON trades FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own trades" ON trades;
CREATE POLICY "Users can delete own trades"
  ON trades FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- TRADE_SCREENSHOTS TABLE - Optimize RLS Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own screenshots" ON trade_screenshots;
CREATE POLICY "Users can view own screenshots"
  ON trade_screenshots FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own screenshots" ON trade_screenshots;
CREATE POLICY "Users can insert own screenshots"
  ON trade_screenshots FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own screenshots" ON trade_screenshots;
CREATE POLICY "Users can delete own screenshots"
  ON trade_screenshots FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- SYNC_LOGS TABLE - Optimize RLS Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own sync logs" ON sync_logs;
CREATE POLICY "Users can view own sync logs"
  ON sync_logs FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own sync logs" ON sync_logs;
CREATE POLICY "Users can insert own sync logs"
  ON sync_logs FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- STRATEGIES TABLE - Optimize RLS Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own strategies" ON strategies;
CREATE POLICY "Users can view own strategies"
  ON strategies FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own strategies" ON strategies;
CREATE POLICY "Users can insert own strategies"
  ON strategies FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own strategies" ON strategies;
CREATE POLICY "Users can update own strategies"
  ON strategies FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own strategies" ON strategies;
CREATE POLICY "Users can delete own strategies"
  ON strategies FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- BACKTESTS TABLE - Optimize RLS Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own backtests" ON backtests;
CREATE POLICY "Users can view own backtests"
  ON backtests FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own backtests" ON backtests;
CREATE POLICY "Users can insert own backtests"
  ON backtests FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own backtests" ON backtests;
CREATE POLICY "Users can update own backtests"
  ON backtests FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own backtests" ON backtests;
CREATE POLICY "Users can delete own backtests"
  ON backtests FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);