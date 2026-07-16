-- ============================================================
-- diagnostic_self_hosted.sql
--
-- Ejecuta esto en tu Supabase self-hosted (p.ej. via psql o
-- el SQL Editor de Supabase Studio) para diagnosticar por qué
-- la configuración de WhatsApp no funciona.
--
-- Resultado: cada bloque IMPRIME un diagnóstico. Si algo sale
-- mal, el mensaje te dice qué migración faltó o qué corregir.
-- ============================================================

-- 1. Verificar extensión uuid-ossp (requerida por migración 001)
SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp'
  ) THEN '✅ uuid-ossp instalada' ELSE '❌ FALTA uuid-ossp — ejecuta: CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
  END AS diagnostico_uuid;

-- 2. Verificar extensión pgvector (requerida por migración 030)
SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  ) THEN '✅ pgvector instalada' ELSE '⚠️  pgvector no instalada (opcional, solo para búsqueda semántica AI)'
  END AS diagnostico_vector;

-- 3. Verificar función is_account_member (requerida por migración 017)
SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'is_account_member'
  ) THEN '✅ is_account_member() existe' ELSE '❌ FALTA is_account_member() — aplica migración 017'
  END AS diagnostico_rls_func;

-- 4. Verificar tabla whatsapp_config y sus columnas
SELECT
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'whatsapp_config') THEN '❌ FALTA tabla whatsapp_config — aplica migración 001'
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'whatsapp_config' AND column_name = 'account_id'
    ) THEN '❌ FALTA columna account_id en whatsapp_config — aplica migración 017'
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'whatsapp_config' AND column_name = 'registered_at'
    ) THEN '⚠️  FALTA columna registered_at — aplica migración 015'
    ELSE '✅ whatsapp_config completa (account_id + registered_at OK)'
  END AS diagnostico_whatsapp_config;

-- 5. Verificar RLS habilitado en whatsapp_config
SELECT
  CASE WHEN (
    SELECT relrowsecurity FROM pg_class WHERE relname = 'whatsapp_config'
  ) THEN '✅ RLS habilitado en whatsapp_config' ELSE '❌ RLS NO habilitado — ejecuta: ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;'
  END AS diagnostico_rls_whatsapp;

-- 6. Verificar políticas RLS de whatsapp_config
SELECT
  count(*) AS total_politicas_whatsapp_config,
  CASE
    WHEN count(*) >= 4 THEN '✅ 4+ políticas RLS presentes'
    ELSE '❌ Faltan políticas RLS (' || count(*) || '/4) — re-aplica migración 017'
  END AS diagnostico_politicas
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'whatsapp_config';

-- 7. Verificar profiles — ¿tiene account_id y account_role?
SELECT
  CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'profiles' AND column_name = 'account_id'
    ) THEN '❌ FALTA account_id en profiles — aplica migración 017'
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'profiles' AND column_name = 'account_role'
    ) THEN '❌ FALTA account_role en profiles — aplica migración 017'
    ELSE '✅ profiles tiene account_id + account_role'
  END AS diagnostico_profiles;

-- 8. Listar usuarios y su estado de cuenta/rol
SELECT
  p.user_id,
  p.full_name,
  p.email,
  p.account_id,
  p.account_role,
  CASE
    WHEN p.account_id IS NULL THEN '❌ Sin account_id'
    WHEN p.account_role IS NULL THEN '❌ Sin account_role'
    WHEN p.account_role IN ('owner', 'admin') THEN '✅ Puede configurar WhatsApp'
    WHEN p.account_role = 'agent' THEN '⚠️  Rol agent — NO puede guardar WhatsApp config (requiere admin+)'
    ELSE '⚠️  Rol desconocido: ' || p.account_role::text
  END AS whatsapp_access
FROM profiles p
ORDER BY p.created_at;

-- 9. Verificar cuenta unificada (single-tenant)
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM accounts WHERE id = '5f88a46f-0433-41df-9646-fd8ff36a2cdb'
    ) THEN '✅ Account unificado existe'
    ELSE '⚠️  Account unificado NO existe (5f88a46f-...) — nuevos usuarios caen en cuenta personal (fallback OK)'
  END AS diagnostico_account_unificado;

-- 10. Verificar todas las cuentas existentes
SELECT
  a.id,
  a.name,
  a.owner_user_id,
  (SELECT count(*) FROM profiles p WHERE p.account_id = a.id) AS miembros,
  CASE
    WHEN a.id = '5f88a46f-0433-41df-9646-fd8ff36a2cdb' THEN '← unified'
    ELSE '← personal'
  END AS tipo
FROM accounts a
ORDER BY a.created_at;

-- 11. Verificar whatsapp_config existente
SELECT
  wc.account_id,
  wc.phone_number_id,
  wc.status,
  wc.registered_at,
  wc.connected_at,
  CASE
    WHEN wc.access_token IS NOT NULL THEN '✅ Token guardado'
    ELSE '❌ Sin token'
  END AS token_state
FROM whatsapp_config wc;
