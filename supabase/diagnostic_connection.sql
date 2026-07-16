-- ============================================================
-- diagnostic_connection.sql
--
-- Verifica la comunicación entre CRM y Supabase desde el
-- SQL Editor. Ejecuta bloque por bloque.
-- ============================================================

-- 1. Verificar que auth.users tiene datos (que el CRM puede crear usuarios)
SELECT count(*) AS total_usuarios FROM auth.users;

-- 2. Verificar profiles existen
SELECT count(*) AS total_profiles FROM profiles;

-- 3. Verificar cuentas existen
SELECT count(*) AS total_accounts FROM accounts;

-- 4. Verificar whatsapp_config (debería ser 0 si no has guardado nada)
SELECT count(*) AS total_whatsapp_config FROM whatsapp_config;

-- 5. Verificar que las políticas RLS existen
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('whatsapp_config', 'profiles', 'accounts')
ORDER BY tablename, policyname;

-- 6. Verificar que is_account_member funciona
-- (cambia el UUID por uno real de profiles si falla)
SELECT is_account_member(
  (SELECT account_id FROM profiles LIMIT 1),
  'admin'::account_role_enum
) AS puede_administrar_whatsapp;

-- 7. Verificar RLS habilitado
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('whatsapp_config', 'profiles', 'accounts')
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 8. Verificar columnas de whatsapp_config
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'whatsapp_config'
ORDER BY ordinal_position;
