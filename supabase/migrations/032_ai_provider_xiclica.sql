-- ============================================================
-- 032_ai_provider_xiclica.sql — Add xiclica-ia-plan provider
--
-- Extends the provider CHECK constraint on ai_configs to accept
-- the new 'xiclica-ia-plan' value — an OpenAI-compatible plan
-- via OpenCode Go (https://opencode.ai/zen/go/v1).
-- ============================================================

ALTER TABLE ai_configs DROP CONSTRAINT IF EXISTS ai_configs_provider_check;
ALTER TABLE ai_configs ADD CONSTRAINT ai_configs_provider_check
  CHECK (provider IN ('openai', 'anthropic', 'xiclica-ia-plan'));
