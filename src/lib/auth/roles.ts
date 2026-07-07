// ============================================================
// Account role helpers — pure, unit-testable, no I/O.
//
// Mirrors the `account_role_enum` Postgres type from migration
// 017_account_sharing.sql. The hierarchy is intentionally a flat
// ordinal (owner=4 … viewer=1) — it matches the same CASE
// expression the `is_account_member(account_id, min_role)` SQL
// helper uses, so server-side TypeScript guards and database-side
// RLS speak the same language.
//
// Predicates (`canManageMembers`, `canEditSettings`, …) are the
// single source of truth for "what can this role do?" — both
// API route guards and UI gates should call them rather than
// open-coding their own role checks. That keeps role-policy
// changes a one-file diff.
// ============================================================

export type AccountRole = "owner" | "admin" | "agent" | "viewer";

/** Ordered list of every valid role, lowest privilege first. */
export const ACCOUNT_ROLES: readonly AccountRole[] = [
  "viewer",
  "agent",
  "admin",
  "owner",
] as const;

/**
 * Numeric rank of a role. Higher = more privileged. Mirrors the
 * CASE expression in `is_account_member` so JS/SQL stay aligned.
 */
export function roleRank(role: AccountRole): number {
  switch (role) {
    case "owner":
      return 4;
    case "admin":
      return 3;
    case "agent":
      return 2;
    case "viewer":
      return 1;
  }
}

/**
 * True iff `role` is at least as privileged as `min`. Use this
 * for any "user has at least admin" / "at least agent" checks.
 */
export function hasMinRole(role: AccountRole, min: AccountRole): boolean {
  return roleRank(role) >= roleRank(min);
}

/** Type-narrow an unknown string into a valid `AccountRole`. */
export function isAccountRole(value: unknown): value is AccountRole {
  return (
    typeof value === "string" &&
    (ACCOUNT_ROLES as readonly string[]).includes(value)
  );
}

// ============================================================
// Capability predicates
//
// Every UI gate and API route guard should call one of these
// instead of comparing role strings inline. Adding a capability
// = one new predicate here + one call site change per consumer.
//
// NOTE: These predicates are FALLBACK defaults used when no
// configurable roles exist in BD. When roles are configured,
// use `canDo()` from use-role-permissions instead.
// ============================================================

/** Owner / admin: invite, remove, change roles. */
export function canManageMembers(role: AccountRole): boolean {
  return hasMinRole(role, "admin");
}

/**
 * Owner / admin: edit account-wide settings (WhatsApp config,
 * message templates, pipelines, tags, custom fields, account
 * name). Excludes per-user settings like avatar or own password.
 */
export function canEditSettings(role: AccountRole): boolean {
  return hasMinRole(role, "admin");
}

/**
 * Owner / admin / agent: write operational data — send messages,
 * create contacts, move deals, run broadcasts, edit automations.
 * Viewers are read-only.
 */
export function canSendMessages(role: AccountRole): boolean {
  return hasMinRole(role, "agent");
}

/**
 * Viewer: read-only across everything. Provided as a positive
 * predicate so UI gates read naturally (`if (canViewOnly(role))`
 * shows the "Read-only" tooltip without inverting `canSendMessages`).
 */
export function canViewOnly(role: AccountRole): boolean {
  return role === "viewer";
}

/** Owner only: irreversible destructive operations. */
export function canDeleteAccount(role: AccountRole): boolean {
  return role === "owner";
}

/** Owner only: hand the account to another member. */
export function canTransferOwnership(role: AccountRole): boolean {
  return role === "owner";
}

// ============================================================
// Configurable permission checking
//
// Uses RolePermissions from BD. Owner always gets full access
// regardless of configured permissions.
// ============================================================

import type { RolePermissions } from "@/types/roles";

/**
 * Check if a role has a specific permission. Owner always returns true.
 * @param role - The account role (for owner bypass)
 * @param permissions - The role's permissions from BD
 * @param module - The module key (e.g. 'contacts', 'settings')
 * @param action - The action key (e.g. 'create', 'edit', 'delete')
 */
export function canDo(
  role: AccountRole,
  permissions: RolePermissions,
  module: string,
  action: string,
): boolean {
  if (role === 'owner') return true;
  return permissions[module]?.[action] === true;
}

/**
 * Get all modules a role has access to (at least view).
 * Owner gets all modules.
 */
export function getAccessibleModules(
  role: AccountRole,
  permissions: RolePermissions,
): string[] {
  if (role === 'owner') {
    return [
      'dashboard', 'inbox', 'notifications', 'contacts',
      'pipelines', 'broadcasts', 'automations', 'flows',
      'agent_performance', 'settings',
    ];
  }
  return Object.entries(permissions)
    .filter(([, actions]) => actions.view === true)
    .map(([mod]) => mod);
}

/**
 * Default permissions for a role when no BD config exists.
 * Matches the seed data from migration 033.
 */
export function getDefaultPermissions(role: AccountRole): RolePermissions {
  switch (role) {
    case 'owner':
    case 'admin':
      return {
        dashboard: { view: true },
        inbox: { view: true, send: true, read: true },
        notifications: { view: true },
        contacts: { view: true, create: true, edit: true, delete: true, import: true },
        pipelines: { view: true, edit: true, move_deals: true },
        broadcasts: { view: true, create: true, send: true },
        automations: { view: true, create: true, edit: true },
        flows: { view: true, create: true, edit: true },
        agent_performance: { view: role === 'owner' || role === 'admin' },
        settings: {
          whatsapp: true, templates: true, fields_tags: true,
          deals_currency: true, members: true, ai: true, api_keys: true,
          roles: role === 'owner',
        },
      };
    case 'agent':
      return {
        dashboard: { view: true },
        inbox: { view: true, send: true, read: true },
        notifications: { view: true },
        contacts: { view: true, create: true, edit: true, delete: false, import: false },
        pipelines: { view: true, edit: false, move_deals: true },
        broadcasts: { view: true, create: false, send: false },
        automations: { view: false, create: false, edit: false },
        flows: { view: false, create: false, edit: false },
        agent_performance: { view: false },
        settings: {
          whatsapp: false, templates: false, fields_tags: false,
          deals_currency: false, members: false, ai: false, api_keys: false, roles: false,
        },
      };
    case 'viewer':
      return {
        dashboard: { view: true },
        inbox: { view: true, send: false, read: true },
        notifications: { view: true },
        contacts: { view: true, create: false, edit: false, delete: false, import: false },
        pipelines: { view: true, edit: false, move_deals: false },
        broadcasts: { view: true, create: false, send: false },
        automations: { view: false, create: false, edit: false },
        flows: { view: false, create: false, edit: false },
        agent_performance: { view: false },
        settings: {
          whatsapp: false, templates: false, fields_tags: false,
          deals_currency: false, members: false, ai: false, api_keys: false, roles: false,
        },
      };
  }
}
