/*
  # Fix Security and Performance Issues

  ## Changes Made:
  
  1. **Add Missing Indexes on Foreign Keys**
     - Add index on `discipline_logs.trade_id`
     - Add index on `gamification.user_id`
     - Add index on `trade_emotions.trade_id`
  
  2. **Optimize RLS Policies (Auth Function Initialization)**
     - Replace `auth.uid()` with `(select auth.uid())` in all policies
     - This prevents re-evaluation of auth functions for each row
     - Improves query performance at scale
  
  3. **Remove Unused Indexes**
     - Drop indexes that are not being used by queries
     - Reduces storage overhead and improves write performance
  
  4. **Fix Function Search Path**
     - Set immutable search_path for `handle_new_user` function
  
  ## Performance Impact:
  - Improved query performance on foreign key lookups
  - Reduced RLS policy evaluation overhead
  - Reduced storage and write overhead from unused indexes
*/

-- ============================================================================
-- 1. ADD MISSING INDEXES ON FOREIGN KEYS
-- ============================================================================

-- Index for discipline_logs foreign key
CREATE INDEX IF NOT EXISTS idx_discipline_logs_trade_id 
ON discipline_logs(trade_id);

-- Index for gamification foreign key
CREATE INDEX IF NOT EXISTS idx_gamification_user_id 
ON gamification(user_id);

-- Index for trade_emotions foreign key
CREATE INDEX IF NOT EXISTS idx_trade_emotions_trade_id 
ON trade_emotions(trade_id);

-- ============================================================================
-- 2. OPTIMIZE RLS POLICIES - TRADE_EMOTIONS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own emotions" ON trade_emotions;
CREATE POLICY "Users can view own emotions"
  ON trade_emotions FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own emotions" ON trade_emotions;
CREATE POLICY "Users can insert own emotions"
  ON trade_emotions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own emotions" ON trade_emotions;
CREATE POLICY "Users can update own emotions"
  ON trade_emotions FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own emotions" ON trade_emotions;
CREATE POLICY "Users can delete own emotions"
  ON trade_emotions FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- 3. OPTIMIZE RLS POLICIES - DISCIPLINE_LOGS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own discipline logs" ON discipline_logs;
CREATE POLICY "Users can view own discipline logs"
  ON discipline_logs FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own discipline logs" ON discipline_logs;
CREATE POLICY "Users can insert own discipline logs"
  ON discipline_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own discipline logs" ON discipline_logs;
CREATE POLICY "Users can update own discipline logs"
  ON discipline_logs FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own discipline logs" ON discipline_logs;
CREATE POLICY "Users can delete own discipline logs"
  ON discipline_logs FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- 4. OPTIMIZE RLS POLICIES - AI_INSIGHTS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own insights" ON ai_insights;
CREATE POLICY "Users can view own insights"
  ON ai_insights FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own insights" ON ai_insights;
CREATE POLICY "Users can insert own insights"
  ON ai_insights FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own insights" ON ai_insights;
CREATE POLICY "Users can update own insights"
  ON ai_insights FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================================================
-- 5. OPTIMIZE RLS POLICIES - GAMIFICATION
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own gamification" ON gamification;
CREATE POLICY "Users can view own gamification"
  ON gamification FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own gamification" ON gamification;
CREATE POLICY "Users can insert own gamification"
  ON gamification FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own gamification" ON gamification;
CREATE POLICY "Users can update own gamification"
  ON gamification FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================================================
-- 6. OPTIMIZE RLS POLICIES - TRADER_PROFILES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own profile" ON trader_profiles;
CREATE POLICY "Users can view own profile"
  ON trader_profiles FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON trader_profiles;
CREATE POLICY "Users can insert own profile"
  ON trader_profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON trader_profiles;
CREATE POLICY "Users can update own profile"
  ON trader_profiles FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================================================
-- 7. OPTIMIZE RLS POLICIES - PATTERN_DETECTION
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own patterns" ON pattern_detection;
CREATE POLICY "Users can view own patterns"
  ON pattern_detection FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own patterns" ON pattern_detection;
CREATE POLICY "Users can insert own patterns"
  ON pattern_detection FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own patterns" ON pattern_detection;
CREATE POLICY "Users can update own patterns"
  ON pattern_detection FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own patterns" ON pattern_detection;
CREATE POLICY "Users can delete own patterns"
  ON pattern_detection FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- 8. OPTIMIZE RLS POLICIES - PERFORMANCE_FORECASTS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own forecasts" ON performance_forecasts;
CREATE POLICY "Users can view own forecasts"
  ON performance_forecasts FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- 9. OPTIMIZE RLS POLICIES - TRADING_RULES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own rules" ON trading_rules;
CREATE POLICY "Users can view own rules"
  ON trading_rules FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own rules" ON trading_rules;
CREATE POLICY "Users can insert own rules"
  ON trading_rules FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own rules" ON trading_rules;
CREATE POLICY "Users can update own rules"
  ON trading_rules FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own rules" ON trading_rules;
CREATE POLICY "Users can delete own rules"
  ON trading_rules FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- 10. REMOVE UNUSED INDEXES
-- ============================================================================

-- Drop unused indexes to improve write performance and reduce storage
DROP INDEX IF EXISTS idx_trade_screenshots_user_id;
DROP INDEX IF EXISTS idx_trade_screenshots_trade_id;
DROP INDEX IF EXISTS idx_broker_accounts_api_enabled;
DROP INDEX IF EXISTS idx_broker_accounts_sync_enabled;
DROP INDEX IF EXISTS idx_sync_logs_account_id;
DROP INDEX IF EXISTS idx_sync_logs_user_id;
DROP INDEX IF EXISTS idx_trades_account_id;
DROP INDEX IF EXISTS idx_trades_status;
DROP INDEX IF EXISTS idx_trade_emotions_user_trade;
DROP INDEX IF EXISTS idx_discipline_logs_user_date;
DROP INDEX IF EXISTS idx_ai_insights_unread;
DROP INDEX IF EXISTS idx_market_data_instrument;
DROP INDEX IF EXISTS idx_market_data_timestamp;
DROP INDEX IF EXISTS idx_market_data_timeframe;
DROP INDEX IF EXISTS idx_market_data_lookup;
DROP INDEX IF EXISTS idx_backtests_strategy;
DROP INDEX IF EXISTS idx_backtests_status;
DROP INDEX IF EXISTS idx_backtests_instrument_id;
DROP INDEX IF EXISTS idx_pattern_detection_user;
DROP INDEX IF EXISTS idx_performance_forecasts_user_date;
DROP INDEX IF EXISTS idx_trading_rules_user_active;

-- ============================================================================
-- 11. FIX FUNCTION SEARCH PATH
-- ============================================================================

-- Recreate handle_new_user function with secure search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at)
  VALUES (
    new.id,
    new.email,
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN new;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
