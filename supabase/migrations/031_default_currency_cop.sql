-- ============================================================
-- 031_default_currency_cop
--
-- Change the DB default for accounts.default_currency from 'USD'
-- to 'COP' so newly created accounts default to Colombian Peso.
--
-- Existing accounts are untouched — they keep whatever value they
-- already have (USD or whatever an admin selected).
--
-- The CHECK constraint (^[A-Z]{3}$) stays; COP is a valid ISO-4217
-- code so no structural change needed.
-- ============================================================

ALTER TABLE accounts
  ALTER COLUMN default_currency SET DEFAULT 'COP';
