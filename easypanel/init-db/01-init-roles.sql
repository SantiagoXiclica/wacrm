-- =============================================================================
-- Supabase roles and extensions initialization
-- This runs automatically when the PostgreSQL container starts for the first time
-- =============================================================================

-- ── Roles ──────────────────────────────────────────────────────────────────
-- Supabase expects these roles to exist before PostgREST/GoTrue start

DO $$
BEGIN
  -- anon: unauthenticated requests (read-only by default)
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;

  -- authenticated: logged-in users
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;

  -- service_role: server-side, bypasses RLS
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS NOINHERIT;
  END IF;

  -- authenticator: PostgREST connects as this role, then SET ROLE to anon/authenticated
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'your-super-secret-and-long-postgres-password';
  END IF;

  -- supabase_admin: owner of the auth schema
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin LOGIN CREATEROLE CREATEDB REPLICATION BYPASSRLS;
  END IF;
END
$$;

-- Grant role hierarchy
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;
GRANT supabase_admin TO postgres;

-- ── Extensions ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ── Schemas ────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS realtime;
CREATE SCHEMA IF NOT EXISTS _realtime;
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage to roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO service_role;
GRANT USAGE ON SCHEMA storage TO service_role;

-- Default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA extensions GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA extensions GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA extensions GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- AUTH SCHEMA — GoTrue tables
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS auth.instances (
  id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  raw_base_config text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth.schema_migrations (
  version bigint NOT NULL PRIMARY KEY
);

INSERT INTO auth.schema_migrations (version) VALUES
  (20211021000000), (20211102140000), (20211122151100),
  (20220114185221), (20220214140000), (20220321100000),
  (20220414130000), (20220531120000), (20220614120000),
  (20220811120000), (20221014120000), (20230101000000),
  (20230201000000), (20230301000000), (20230401000000),
  (20230501000000), (20230601000000), (20230701000000),
  (20230801000000), (20230901000000), (20231001000000),
  (20231101000000), (20231201000000), (20240101000000),
  (20240201000000), (20240301000000), (20240401000000),
  (20240501000000), (20240601000000), (20240701000000),
  (20240801000000), (20240901000000), (20241001000000),
  (20241101000000), (20241201000000), (20250101000000),
  (20250201000000), (20250301000000), (20250401000000),
  (20250501000000)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS auth.users (
  instance_id uuid,
  id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  aud varchar(255),
  role varchar(255),
  email varchar(255) UNIQUE,
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  invited_at timestamptz,
  confirmation_token varchar(255),
  confirmation_sent_at timestamptz,
  recovery_token varchar(255),
  recovery_sent_at timestamptz,
  email_change_token_new varchar(255),
  email_change varchar(255),
  email_change_sent_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  is_super_admin boolean,
  created_at timestamptz,
  updated_at timestamptz,
  phone varchar(15) UNIQUE DEFAULT NULL,
  phone_confirmed_at timestamptz,
  phone_change varchar(15) DEFAULT '',
  phone_change_token varchar(255) DEFAULT '',
  phone_change_sent_at timestamptz,
  confirmed_at timestamptz GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
  email_change_token_current varchar(255) DEFAULT '',
  email_change_confirm_status smallint DEFAULT 0,
  banned_until timestamptz,
  reauthentication_token varchar(255) DEFAULT '',
  reauthentication_sent_at timestamptz,
  is_sso_user boolean NOT NULL DEFAULT false,
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
  instance_id uuid,
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  token varchar(255),
  user_id varchar(255),
  revoked boolean,
  created_at timestamptz,
  updated_at timestamptz,
  parent varchar(255),
  session_id uuid
);

CREATE TABLE IF NOT EXISTS auth.instances (
  id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  raw_base_config text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth.sessions (
  id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id varchar(255) NOT NULL,
  created_at timestamptz,
  updated_at timestamptz,
  factor_id uuid,
  aal varchar DEFAULT 'aal1',
  not_after timestamptz,
  refreshed_at timestamptz,
  user_agent text,
  ip inet,
  tag varchar
);

CREATE TABLE IF NOT EXISTS auth.mfa_factors (
  id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id varchar(255) NOT NULL,
  friendly_name varchar,
  factor_type varchar NOT NULL,
  status varchar NOT NULL,
  created_at timestamptz,
  updated_at timestamptz,
  secret text,
  phone varchar,
  webauthn_aaguid uuid
);

CREATE TABLE IF NOT EXISTS auth.mfa_challenges (
  id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  factor_id uuid NOT NULL,
  created_at timestamptz,
  verified_at timestamptz,
  ip inet
);

CREATE TABLE IF NOT EXISTS auth.mfa_amr_claims (
  session_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz NOT NULL DEFAULT now(),
  authentication_method varchar NOT NULL,
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS auth.instances (
  id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  raw_base_config text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth.sso_domains (
  id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain_id uuid NOT NULL,
  sso_provider_id uuid NOT NULL,
  created_at timestamptz,
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS auth.sso_providers (
  id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_id text,
  created_at timestamptz,
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS auth.saml_providers (
  id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  sso_provider_id uuid REFERENCES auth.sso_providers(id) ON DELETE CASCADE,
  entity_id text NOT NULL UNIQUE,
  metadata_xml text NOT NULL,
  metadata_url text,
  attribute_mapping jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  name_id_format text
);

CREATE TABLE IF NOT EXISTS auth.saml_relay_states (
  id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  sso_provider_id uuid REFERENCES auth.sso_providers(id) ON DELETE CASCADE,
  request_id text NOT NULL,
  from_url text,
  to_email text,
  created_at timestamptz
);

CREATE TABLE IF NOT EXISTS auth.flow_state (
  id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id varchar(255) NOT NULL,
  auth_code text NOT NULL,
  auth_code_issued_at timestamptz,
  authentication_method text NOT NULL,
  auth_code_challenge text NOT NULL,
  auth_code_challenge_method varchar NOT NULL,
  code_confirmed_at timestamptz,
  id_token text,
  access_token text,
  refresh_token text,
  session_id uuid GENERATED ALWAYS AS (id) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  authentication_level varchar,
  approved_at timestamptz
);

-- ════════════════════════════════════════════════════════════════════════════
-- STORAGE SCHEMA
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS storage.buckets (
  id text NOT NULL PRIMARY KEY,
  name text NOT NULL,
  owner uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  public boolean DEFAULT false,
  avif_autodetection boolean DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[],
  owner_id text
);

CREATE TABLE IF NOT EXISTS storage.migrations (
  id integer NOT NULL PRIMARY KEY,
  name varchar(255) NOT NULL UNIQUE,
  hash varchar(255) NOT NULL,
  executed_at timestamptz DEFAULT now()
);

INSERT INTO storage.migrations (id, name, hash) VALUES
  (0, '00-initial', 'initial'),
  (1, '01-storage-schema', 'initial'),
  (2, '02-auth-changes', 'initial'),
  (3, '03-add-description-to-buckets', 'initial'),
  (4, '04-add-authorized-changes', 'initial'),
  (5, '05-v0', 'initial'),
  (6, '06-v1', 'initial'),
  (7, '07-v2', 'initial'),
  (8, '08-v3', 'initial'),
  (9, '09-v4', 'initial'),
  (10, '10-v5', 'initial'),
  (11, '11-v6', 'initial'),
  (12, '12-v7', 'initial'),
  (13, '13-v8', 'initial'),
  (14, '14-v9', 'initial'),
  (15, '15-v10', 'initial'),
  (16, '16-v11', 'initial'),
  (17, '17-v12', 'initial')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- REALTIME SCHEMA
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS _realtime.tenants (
  id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  external_id text UNIQUE,
  inserted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS _realtime.extensions (
  id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  type text NOT NULL,
  settings jsonb DEFAULT '{}'::jsonb,
  tenant_external_id text NOT NULL,
  inserted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS _realtime.subscription (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  extension_id uuid NOT NULL,
  entity varchar,
  filters jsonb,
  inserted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, extension_id)
);

-- ════════════════════════════════════════════════════════════════════════════
-- Default bucket for avatars
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;
