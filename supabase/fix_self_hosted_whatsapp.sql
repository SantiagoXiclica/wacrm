-- ============================================================
-- fix_self_hosted_whatsapp.sql
--
-- Repara los problemas más comunes que impiden que la config
-- de WhatsApp funcione en un Supabase self-hosted.
--
-- SEGURO: todo usa IF NOT EXISTS / CREATE OR REPLACE / idempotente.
-- Ejecútalo sin miedo — no borra datos.
-- ============================================================

-- ============================================================
-- 1. EXTENSIONES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 2. TIPOS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_role_enum') THEN
    CREATE TYPE account_role_enum AS ENUM ('owner', 'admin', 'agent', 'viewer');
  END IF;
END $$;

-- ============================================================
-- 3. TABLA accounts (si no existe)
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  default_currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. TABLA whatsapp_config (si no existe)
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number_id TEXT,
  waba_id TEXT,
  access_token TEXT,
  verify_token TEXT,
  status TEXT DEFAULT 'disconnected',
  connected_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ,
  subscribed_apps_at TIMESTAMPTZ,
  last_registration_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;

-- Columnas que pueden faltar en un install viejo
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE whatsapp_config ALTER COLUMN account_id SET NOT NULL;

-- Unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_config_account_id_key'
  ) THEN
    ALTER TABLE whatsapp_config ADD CONSTRAINT whatsapp_config_account_id_key UNIQUE (account_id);
  END IF;
END $$;

-- ============================================================
-- 5. TABLA profiles (asegurar columnas account)
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_role account_role_enum;

-- ============================================================
-- 6. FUNCIÓN is_account_member
-- ============================================================
CREATE OR REPLACE FUNCTION is_account_member(
  target_account_id UUID,
  min_role account_role_enum DEFAULT 'viewer'
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.account_id = target_account_id
      AND CASE p.account_role
            WHEN 'owner'  THEN 4
            WHEN 'admin'  THEN 3
            WHEN 'agent'  THEN 2
            WHEN 'viewer' THEN 1
          END
        >=
          CASE min_role
            WHEN 'owner'  THEN 4
            WHEN 'admin'  THEN 3
            WHEN 'agent'  THEN 2
            WHEN 'viewer' THEN 1
          END
  );
$$;

ALTER FUNCTION is_account_member(UUID, account_role_enum) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION is_account_member(UUID, account_role_enum) TO authenticated, service_role;

-- ============================================================
-- 7. RLS POLICIES para whatsapp_config
-- ============================================================
-- Primero limpiar políticas viejas
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'whatsapp_config'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.whatsapp_config', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY whatsapp_config_select ON whatsapp_config
  FOR SELECT USING (is_account_member(account_id));

CREATE POLICY whatsapp_config_insert ON whatsapp_config
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));

CREATE POLICY whatsapp_config_update ON whatsapp_config
  FOR UPDATE USING (is_account_member(account_id, 'admin'));

CREATE POLICY whatsapp_config_delete ON whatsapp_config
  FOR DELETE USING (is_account_member(account_id, 'admin'));

-- ============================================================
-- 8. ASIGNAR CADA USUARIO A UNA CUENTA
--
-- Para cada usuario sin account_id, crea una cuenta personal
-- con rol owner. Esto garantiza que TODOS los usuarios
-- puedan configurar WhatsApp.
-- ============================================================
DO $$
DECLARE
  r RECORD;
  v_account_id UUID;
BEGIN
  FOR r IN
    SELECT p.id AS profile_id, p.user_id, p.full_name, p.email
    FROM profiles p
    WHERE p.account_id IS NULL
  LOOP
    -- Crear cuenta personal
    INSERT INTO accounts (name, owner_user_id)
    VALUES (
      COALESCE(NULLIF(r.full_name, ''), r.email, 'My account'),
      r.user_id
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_account_id;

    -- Si no se creó (constraint unique), buscar la existente
    IF v_account_id IS NULL THEN
      SELECT a.id INTO v_account_id
      FROM accounts a WHERE a.owner_user_id = r.user_id;
    END IF;

    -- Asignar al usuario
    UPDATE profiles
    SET account_id = v_account_id,
        account_role = 'owner'
    WHERE id = r.profile_id;

    RAISE NOTICE 'User % assigned to account % with role owner', r.email, v_account_id;
  END LOOP;
END $$;

-- ============================================================
-- 9. ASEGURAR que TODOS los usuarios tengan account_id NOT NULL
-- ============================================================
-- Si aún hay NULLs después del paso 8, crear cuentas de emergencia
DO $$
DECLARE
  r RECORD;
  v_account_id UUID;
BEGIN
  FOR r IN
    SELECT p.id AS profile_id, p.user_id, p.full_name, p.email
    FROM profiles p
    WHERE p.account_id IS NULL
  LOOP
    INSERT INTO accounts (name, owner_user_id)
    VALUES (COALESCE(r.full_name, r.email, 'Account'), r.user_id)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_account_id;

    IF v_account_id IS NULL THEN
      SELECT a.id INTO v_account_id
      FROM accounts a WHERE a.owner_user_id = r.user_id;
    END IF;

    UPDATE profiles
    SET account_id = v_account_id,
        account_role = COALESCE(account_role, 'owner')
    WHERE id = r.profile_id;
  END LOOP;
END $$;

-- ============================================================
-- 10. VERIFICACIÓN FINAL
-- ============================================================
SELECT '✅ Diagnostic results:' AS info;

SELECT
  p.email,
  p.account_id,
  p.account_role::text AS rol,
  CASE
    WHEN p.account_id IS NULL THEN '❌ SIN CUENTA'
    WHEN p.account_role IN ('owner', 'admin') THEN '✅ Puede configurar WhatsApp'
    WHEN p.account_role = 'agent' THEN '⚠️ Rol agent — necesita upgrade a admin'
    ELSE '⚠️ Rol: ' || p.account_role::text
  END AS estado
FROM profiles p;

SELECT
  'whatsapp_config rows: ' || count(*)::text AS info
FROM whatsapp_config;
