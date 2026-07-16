-- ============================================================
-- fix_missing_profiles.sql
--
-- Crea profiles + accounts para TODOS los usuarios de auth.users
-- que no tengan perfil. Repara el trigger roto.
-- ============================================================

-- 1. Crear profiles + accounts faltantes
DO $$
DECLARE
  r RECORD;
  v_account_id UUID;
  v_full_name TEXT;
BEGIN
  FOR r IN
    SELECT u.id, u.email, u.raw_user_meta_data
    FROM auth.users u
    WHERE NOT EXISTS (
      SELECT 1 FROM profiles p WHERE p.user_id = u.id
    )
  LOOP
    v_full_name := COALESCE(r.raw_user_meta_data->>'full_name', '');

    -- Crear cuenta personal
    INSERT INTO accounts (name, owner_user_id)
    VALUES (
      COALESCE(NULLIF(v_full_name, ''), r.email, 'My account'),
      r.id
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_account_id;

    IF v_account_id IS NULL THEN
      SELECT a.id INTO v_account_id
      FROM accounts a WHERE a.owner_user_id = r.id;
    END IF;

    -- Crear perfil
    INSERT INTO profiles (user_id, full_name, email, account_id, account_role)
    VALUES (r.id, v_full_name, r.email, v_account_id, 'owner')
    ON CONFLICT (user_id) DO UPDATE SET
      account_id = v_account_id,
      account_role = 'owner';

    RAISE NOTICE 'Profile created for % → account %', r.email, v_account_id;
  END LOOP;
END $$;

-- 2. Verificar resultado
SELECT
  p.email,
  p.account_id::text,
  p.account_role::text AS rol,
  '✅ OK' AS estado
FROM profiles p;

-- 3. Reinstalar el trigger handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_account_id UUID;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  INSERT INTO public.accounts (name, owner_user_id)
  VALUES (COALESCE(NULLIF(v_full_name, ''), NEW.email, 'My account'), NEW.id)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_account_id;

  IF v_account_id IS NULL THEN
    SELECT a.id INTO v_account_id
    FROM accounts a WHERE a.owner_user_id = NEW.id;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, email, account_id, account_role)
  VALUES (NEW.id, v_full_name, NEW.email, v_account_id, 'owner')
  ON CONFLICT (user_id) DO UPDATE SET
    account_id = v_account_id,
    account_role = 'owner';

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to bootstrap profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- 4. Asegurar que el trigger existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
