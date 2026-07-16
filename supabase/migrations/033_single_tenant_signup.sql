-- ============================================================
-- 033_single_tenant_signup.sql — Forzar single-tenant en el alta de usuarios
--
-- CONTEXTO
--   NEXIA-CRM es single-tenant: TODOS los usuarios pertenecen a la
--   misma cuenta corporativa (5f88a46f-0433-41df-9646-fd8ff36a2cdb).
--   El trigger handle_new_user heredado de wacrm creaba una cuenta
--   personal nueva por cada signup, lo que provocó el bug
--   "agent-performance sin datos" (AGENTS.md §10): usuarios como
--   Comercial1/Comercial2 quedaban en account_id distintos y sus
--   conversaciones eran invisibles para el resto del equipo.
--
-- CAMBIOS
--   1. handle_new_user: asigna directamente al account unificado con
--      rol por defecto 'agent'. Ya NO crea cuentas personales.
--      Fallback defensivo: si el account unificado no existe, crea
--      una personal (comportamiento legacy) para no romper el signup.
--
--   2. redeem_invitation: en single-tenant el invitado ya queda en el
--      account unificado desde el signup, por lo que "unirse" se
--      convierte en un upgrade de rol (agent → admin, etc.). La
--      validación "you are already a member" pasa de ser error a ser
--      éxito que actualiza el rol. Se conserva el path legacy para
--      usuarios antiguos con cuenta personal propia.
--
-- COMPATIBILIDAD
--   - Usuarios existentes NO se tocan.
--   - El flujo de invitación sigue funcionando: el admin invita, el
--     invitado se registra, verifica email, acepta en /join/<token>,
--     y redeem_invitation sube su rol al invitado.
--   - El bloqueo de UX (signup sin invite) se hace en el frontend.
-- ============================================================

-- ============================================================
-- 1) handle_new_user — single-tenant
--
-- En lugar de INSERT en accounts + profiles(owner), ahora solo
-- INSERT en profiles apuntando al account unificado con rol 'agent'.
-- El admin puede promocionar el rol después vía Settings → Members.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_unified_account_id CONSTANT UUID := '5f88a46f-0433-41df-9646-fd8ff36a2cdb'::UUID;
  v_account_exists BOOLEAN;
  v_fallback_account_id UUID;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  SELECT EXISTS(SELECT 1 FROM accounts WHERE id = v_unified_account_id)
    INTO v_account_exists;

  IF v_account_exists THEN
    -- Single-tenant: el usuario se une directamente a la cuenta
    -- corporativa con rol 'agent'. El flujo de invitación puede
    -- subir el rol después (agent → admin/viewer) vía redeem_invitation.
    INSERT INTO public.profiles (user_id, full_name, email, account_id, account_role)
    VALUES (NEW.id, v_full_name, NEW.email, v_unified_account_id, 'agent');
  ELSE
    -- Fallback defensivo: si el account unificado no existe (p.ej.
    -- en un entorno fresh-install o tests), caemos al comportamiento
    -- legacy para no bloquear el signup por completo.
    RAISE WARNING 'Unified account % not found; falling back to personal account for user %',
      v_unified_account_id, NEW.id;

    INSERT INTO public.accounts (name, owner_user_id)
    VALUES (COALESCE(NULLIF(v_full_name, ''), NEW.email, 'My account'), NEW.id)
    RETURNING id INTO v_fallback_account_id;

    INSERT INTO public.profiles (user_id, full_name, email, account_id, account_role)
    VALUES (NEW.id, v_full_name, NEW.email, v_fallback_account_id, 'owner');
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to bootstrap account/profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;


-- ============================================================
-- 2) redeem_invitation — soporte single-tenant
--
-- En el flujo original, redeem movía el profile de una cuenta
-- personal a la del inviter. En single-tenant el nuevo usuario ya
-- queda en el account unificado desde el trigger, por lo que el
-- redeem solo necesita actualizar el rol.
--
-- Cuando el caller YA está en el account de la invitación:
--   - Actualiza account_role al rol invitado
--   - Marca la invitación como aceptada
--   - Retorna el account_id (éxito)
--
-- Cuando el caller está en OTRO account (legacy o edge case):
--   - Conserva toda la lógica de seguridad original
-- ============================================================

CREATE OR REPLACE FUNCTION public.redeem_invitation(
  p_token_hash TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_inv account_invitations%ROWTYPE;
  v_old_account_id UUID;
  v_old_account_owner UUID;
  v_has_data BOOLEAN;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inv
  FROM account_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = '22023';
  END IF;
  IF v_inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation has already been redeemed'
      USING ERRCODE = '22023';
  END IF;
  IF v_inv.expires_at <= NOW() THEN
    RAISE EXCEPTION 'Invitation has expired' USING ERRCODE = '22023';
  END IF;

  -- Caller's current account + its owner.
  SELECT p.account_id, a.owner_user_id
  INTO v_old_account_id, v_old_account_owner
  FROM profiles p
  JOIN accounts a ON a.id = p.account_id
  WHERE p.user_id = v_caller_id;

  IF v_old_account_id IS NULL THEN
    RAISE EXCEPTION 'Caller has no profile' USING ERRCODE = '42501';
  END IF;

  -- ============================================================
  -- SINGLE-TENANT PATH: el caller ya está en el account unificado
  -- (mismo que el de la invitación). En lugar de error, esto es
  -- el caso normal: solo subimos el rol al invitado.
  -- ============================================================
  IF v_old_account_id = v_inv.account_id THEN
    UPDATE profiles
    SET account_role = v_inv.role
    WHERE user_id = v_caller_id;

    UPDATE account_invitations
    SET accepted_at = NOW(),
        accepted_by_user_id = v_caller_id
    WHERE id = v_inv.id;

    RETURN v_inv.account_id;
  END IF;

  -- ============================================================
  -- LEGACY PATH: el caller está en un account distinto (cuenta
  -- personal pre-033 o edge case). Conservamos los chequeos de
  -- seguridad originales para no perder datos.
  -- ============================================================

  -- El caller debe ser el único owner de su cuenta actual.
  IF v_old_account_owner <> v_caller_id THEN
    RAISE EXCEPTION 'You are already in a shared account; sign up with a different email to join this one'
      USING ERRCODE = '23505';
  END IF;

  -- Rechazar si la cuenta actual tiene datos de dominio.
  SELECT EXISTS (
    SELECT 1 FROM contacts WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM conversations WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM broadcasts WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM automations WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM flows WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM pipelines WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM message_templates WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM tags WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM custom_fields WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM contact_notes WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM whatsapp_config WHERE account_id = v_old_account_id
    LIMIT 1
  ) INTO v_has_data;

  IF v_has_data THEN
    RAISE EXCEPTION 'Your account already contains data; sign up with a different email to join this one'
      USING ERRCODE = '23505';
  END IF;

  -- Mover el profile antes de borrar la cuenta vieja (evita cascade).
  UPDATE profiles
  SET account_id = v_inv.account_id,
      account_role = v_inv.role
  WHERE user_id = v_caller_id;

  UPDATE account_invitations
  SET accepted_at = NOW(),
      accepted_by_user_id = v_caller_id
  WHERE id = v_inv.id;

  DELETE FROM accounts WHERE id = v_old_account_id;

  RETURN v_inv.account_id;
END;
$$;

ALTER FUNCTION public.redeem_invitation(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.redeem_invitation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_invitation(TEXT) TO authenticated;
