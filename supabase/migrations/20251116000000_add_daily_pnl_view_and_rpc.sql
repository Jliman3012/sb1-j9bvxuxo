-- Create daily_pnl_view aggregating wins/losses per Budapest-local trade day
CREATE OR REPLACE VIEW daily_pnl_view AS
SELECT
  t.user_id,
  (timezone('Europe/Budapest', COALESCE(t.exit_date, t.entry_date)))::date AS trade_day,
  SUM(COALESCE(t.pnl, 0) + COALESCE(t.fees, 0)) AS gross_pnl,
  SUM(COALESCE(t.pnl, 0)) AS net_pnl,
  COUNT(*) FILTER (WHERE COALESCE(t.pnl, 0) > 0) AS wins,
  COUNT(*) FILTER (WHERE COALESCE(t.pnl, 0) < 0) AS losses,
  COUNT(*) AS trade_count
FROM trades t
GROUP BY t.user_id, (timezone('Europe/Budapest', COALESCE(t.exit_date, t.entry_date)))::date;

-- Helpful index for day level lookups
CREATE INDEX IF NOT EXISTS idx_trades_user_budapest_day
  ON trades (user_id, (timezone('Europe/Budapest', COALESCE(exit_date, entry_date)))::date);

-- RPC to expose daily aggregates with optional filters
CREATE OR REPLACE FUNCTION get_daily_pnl(
  from_date date,
  to_date date,
  account_ids uuid[] DEFAULT NULL,
  symbols text[] DEFAULT NULL,
  tags text[] DEFAULT NULL,
  sessions text[] DEFAULT NULL
)
RETURNS TABLE (
  trade_day date,
  gross_pnl numeric,
  net_pnl numeric,
  wins integer,
  losses integer,
  trade_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    day_bucket.trade_day,
    SUM(day_bucket.gross_pnl) AS gross_pnl,
    SUM(day_bucket.net_pnl) AS net_pnl,
    SUM(day_bucket.wins) AS wins,
    SUM(day_bucket.losses) AS losses,
    SUM(day_bucket.trade_count) AS trade_count
  FROM (
    SELECT
      (timezone('Europe/Budapest', COALESCE(t.exit_date, t.entry_date)))::date AS trade_day,
      (COALESCE(t.pnl, 0) + COALESCE(t.fees, 0)) AS gross_pnl,
      COALESCE(t.pnl, 0) AS net_pnl,
      CASE WHEN COALESCE(t.pnl, 0) > 0 THEN 1 ELSE 0 END AS wins,
      CASE WHEN COALESCE(t.pnl, 0) < 0 THEN 1 ELSE 0 END AS losses,
      1 AS trade_count
    FROM trades t
    WHERE
      t.user_id = auth.uid()
      AND (timezone('Europe/Budapest', COALESCE(t.exit_date, t.entry_date)))::date BETWEEN from_date AND to_date
      AND (account_ids IS NULL OR t.account_id = ANY(account_ids))
      AND (
        symbols IS NULL OR
        EXISTS (
          SELECT 1 FROM unnest(symbols) s
          WHERE lower(s) = lower(t.symbol)
        )
      )
      AND (
        tags IS NULL OR (
          t.tags IS NOT NULL AND t.tags && tags
        )
      )
      AND (
        sessions IS NULL OR (t.journal_data ->> 'session') = ANY(sessions)
      );
  ) AS day_bucket
  GROUP BY day_bucket.trade_day
  ORDER BY day_bucket.trade_day;
END;
$$;

GRANT EXECUTE ON FUNCTION get_daily_pnl(date, date, uuid[], text[], text[], text[]) TO authenticated;
