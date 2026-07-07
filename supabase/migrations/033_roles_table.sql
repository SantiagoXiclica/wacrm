-- ============================================================
-- 033_roles_table.sql
--
-- Tabla de roles configurables por cuenta. Cada cuenta (account)
-- tiene sus propios roles con permisos granulares en JSONB.
-- Los roles built-in (owner, admin, agent, viewer) se sembran
-- automáticamente para cuentas existentes y nuevas.
-- ============================================================

-- 1. Tabla roles
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rank INT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, name)
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_roles_account_id ON roles(account_id);
CREATE INDEX IF NOT EXISTS idx_roles_account_rank ON roles(account_id, rank);

-- 3. Trigger updated_at
CREATE OR REPLACE FUNCTION set_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS roles_updated_at ON roles;
CREATE TRIGGER roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION set_roles_updated_at();

-- 4. RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Todos los miembros de la cuenta pueden leer roles
DROP POLICY IF EXISTS roles_select ON roles;
CREATE POLICY roles_select ON roles
  FOR SELECT
  USING (is_account_member(account_id));

-- Solo owners pueden insertar/actualizar/eliminar roles
DROP POLICY IF EXISTS roles_insert ON roles;
CREATE POLICY roles_insert ON roles
  FOR INSERT
  WITH CHECK (is_account_member(account_id, 'owner'));

DROP POLICY IF EXISTS roles_update ON roles;
CREATE POLICY roles_update ON roles
  FOR UPDATE
  USING (is_account_member(account_id, 'owner'))
  WITH CHECK (is_account_member(account_id, 'owner'));

DROP POLICY IF EXISTS roles_delete ON roles;
CREATE POLICY roles_delete ON roles
  FOR DELETE
  USING (is_account_member(account_id, 'owner'));

-- 5. Función para sembrar roles por defecto en una cuenta
CREATE OR REPLACE FUNCTION seed_default_roles(target_account_id UUID)
RETURNS VOID AS $$
BEGIN
  -- No sembrar si ya existen roles para esta cuenta
  IF EXISTS (SELECT 1 FROM roles WHERE account_id = target_account_id) THEN
    RETURN;
  END IF;

  -- Owner: rank 10, todos los permisos
  INSERT INTO roles (account_id, name, rank, is_system, permissions) VALUES
  (target_account_id, 'Propietario', 10, true, '{
    "dashboard": {"view": true},
    "inbox": {"view": true, "send": true, "read": true},
    "notifications": {"view": true},
    "contacts": {"view": true, "create": true, "edit": true, "delete": true, "import": true},
    "pipelines": {"view": true, "edit": true, "move_deals": true},
    "broadcasts": {"view": true, "create": true, "send": true},
    "automations": {"view": true, "create": true, "edit": true},
    "flows": {"view": true, "create": true, "edit": true},
    "agent_performance": {"view": true},
    "settings": {"whatsapp": true, "templates": true, "fields_tags": true, "deals_currency": true, "members": true, "ai": true, "api_keys": true, "roles": true}
  }');

  -- Admin: rank 8, todo excepto roles
  INSERT INTO roles (account_id, name, rank, is_system, permissions) VALUES
  (target_account_id, 'Administrador', 8, true, '{
    "dashboard": {"view": true},
    "inbox": {"view": true, "send": true, "read": true},
    "notifications": {"view": true},
    "contacts": {"view": true, "create": true, "edit": true, "delete": true, "import": true},
    "pipelines": {"view": true, "edit": true, "move_deals": true},
    "broadcasts": {"view": true, "create": true, "send": true},
    "automations": {"view": true, "create": true, "edit": true},
    "flows": {"view": true, "create": true, "edit": true},
    "agent_performance": {"view": true},
    "settings": {"whatsapp": true, "templates": true, "fields_tags": true, "deals_currency": true, "members": true, "ai": true, "api_keys": true, "roles": false}
  }');

  -- Agent: rank 5, solo operaciones
  INSERT INTO roles (account_id, name, rank, is_system, permissions) VALUES
  (target_account_id, 'Agente', 5, true, '{
    "dashboard": {"view": true},
    "inbox": {"view": true, "send": true, "read": true},
    "notifications": {"view": true},
    "contacts": {"view": true, "create": true, "edit": true, "delete": false, "import": false},
    "pipelines": {"view": true, "edit": false, "move_deals": true},
    "broadcasts": {"view": true, "create": false, "send": false},
    "automations": {"view": false, "create": false, "edit": false},
    "flows": {"view": false, "create": false, "edit": false},
    "agent_performance": {"view": false},
    "settings": {"whatsapp": false, "templates": false, "fields_tags": false, "deals_currency": false, "members": false, "ai": false, "api_keys": false, "roles": false}
  }');

  -- Viewer: rank 1, solo lectura
  INSERT INTO roles (account_id, name, rank, is_system, permissions) VALUES
  (target_account_id, 'Visor', 1, true, '{
    "dashboard": {"view": true},
    "inbox": {"view": true, "send": false, "read": true},
    "notifications": {"view": true},
    "contacts": {"view": true, "create": false, "edit": false, "delete": false, "import": false},
    "pipelines": {"view": true, "edit": false, "move_deals": false},
    "broadcasts": {"view": true, "create": false, "send": false},
    "automations": {"view": false, "create": false, "edit": false},
    "flows": {"view": false, "create": false, "edit": false},
    "agent_performance": {"view": false},
    "settings": {"whatsapp": false, "templates": false, "fields_tags": false, "deals_currency": false, "members": false, "ai": false, "api_keys": false, "roles": false}
  }');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Sembrar roles para cuentas existentes
DO $$
DECLARE
  acc RECORD;
BEGIN
  FOR acc IN SELECT id FROM accounts LOOP
    PERFORM seed_default_roles(acc.id);
  END LOOP;
END;
$$;

-- 7. Trigger para sembrar roles al crear cuenta nueva
CREATE OR REPLACE FUNCTION trigger_seed_roles_on_account_create()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM seed_default_roles(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS seed_roles_on_account_create ON accounts;
CREATE TRIGGER seed_roles_on_account_create
  AFTER INSERT ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_seed_roles_on_account_create();
