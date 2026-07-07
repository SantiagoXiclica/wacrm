"use client";

import { useAuth } from "@/hooks/use-auth";
import { useRolePermissions } from "@/hooks/use-role-permissions";
import {
  canDeleteAccount,
  canEditSettings,
  canManageMembers,
  canSendMessages,
  canTransferOwnership,
  canViewOnly,
} from "@/lib/auth/roles";

/**
 * Legacy coarse-grained action keys. These map to the original
 * RBAC predicates and are kept for backward compatibility.
 */
export type CanAction =
  | "manage-members"
  | "edit-settings"
  | "send-messages"
  | "view-only"
  | "delete-account"
  | "transfer-ownership";

/**
 * Granular permission keys for configurable roles.
 * Format: "module.action" (e.g. "contacts.create", "settings.whatsapp")
 */
export type GranularAction =
  | "dashboard.view"
  | "inbox.view"
  | "inbox.send"
  | "inbox.read"
  | "notifications.view"
  | "contacts.view"
  | "contacts.create"
  | "contacts.edit"
  | "contacts.delete"
  | "contacts.import"
  | "pipelines.view"
  | "pipelines.edit"
  | "pipelines.move_deals"
  | "broadcasts.view"
  | "broadcasts.create"
  | "broadcasts.send"
  | "automations.view"
  | "automations.create"
  | "automations.edit"
  | "flows.view"
  | "flows.create"
  | "flows.edit"
  | "agent_performance.view"
  | "settings.whatsapp"
  | "settings.templates"
  | "settings.fields_tags"
  | "settings.deals_currency"
  | "settings.members"
  | "settings.ai"
  | "settings.api_keys"
  | "settings.roles";

/**
 * Inline alternative to `<RequireRole>` for places that need a
 * boolean rather than a render conditional — typically disabled-
 * state on buttons, the readOnly flag on inputs, or controlling
 * tooltip copy ("Read-only" vs the action label).
 *
 * Returns `false` while `profileLoading` is true so transient
 * "you can!" flashes never appear to under-privileged users.
 *
 * Example:
 *   const canEdit = useCan("edit-settings");
 *   <Button disabled={!canEdit} title={canEdit ? "Save" : "Read-only"} />
 */
export function useCan(action: CanAction): boolean {
  const { profileLoading, accountRole } = useAuth();
  if (profileLoading || !accountRole) return false;

  switch (action) {
    case "manage-members":
      return canManageMembers(accountRole);
    case "edit-settings":
      return canEditSettings(accountRole);
    case "send-messages":
      return canSendMessages(accountRole);
    case "view-only":
      return canViewOnly(accountRole);
    case "delete-account":
      return canDeleteAccount(accountRole);
    case "transfer-ownership":
      return canTransferOwnership(accountRole);
    default: {
      const _exhaustive: never = action;
      throw new Error(`Unknown CanAction: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Check granular permissions from configurable roles in BD.
 * Uses the role_permissions from the roles table.
 *
 * Example:
 *   const can = useCanGranular();
 *   if (can("contacts.create")) { ... }
 */
export function useCanGranular(): (action: GranularAction) => boolean {
  const { profileLoading, accountRole } = useAuth();
  const { canDo, loading: rolesLoading } = useRolePermissions();

  return (action: GranularAction): boolean => {
    if (profileLoading || rolesLoading || !accountRole) return false;
    const [module, act] = action.split(".") as [string, string];
    return canDo(module, act);
  };
}
