-- Add initial risk column to trades for R-multiple calculations
ALTER TABLE trades ADD COLUMN IF NOT EXISTS initial_risk NUMERIC;

-- Ensure r_multiple column exists (idempotent safety)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS r_multiple NUMERIC;

-- Backfill existing trades with initial_risk derived from stop_price when available
UPDATE trades
SET initial_risk = ABS((entry_price - stop_price) * quantity)
WHERE initial_risk IS NULL
  AND stop_price IS NOT NULL
  AND quantity IS NOT NULL
  AND entry_price IS NOT NULL;

-- Derive r_multiple for trades that have initial_risk and pnl
UPDATE trades
SET r_multiple = CASE
  WHEN initial_risk IS NOT NULL AND initial_risk <> 0 THEN pnl / initial_risk
  ELSE r_multiple
END
WHERE pnl IS NOT NULL;
