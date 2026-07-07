// ============================================================
// Configurable roles types (migration 033)
//
// Separate from index.ts to avoid circular import with
// @/lib/auth/roles.ts which imports RolePermissions.
// ============================================================

export type PermissionModule =
  | 'dashboard'
  | 'inbox'
  | 'notifications'
  | 'contacts'
  | 'pipelines'
  | 'broadcasts'
  | 'automations'
  | 'flows'
  | 'agent_performance'
  | 'settings';

export type PermissionAction = string;

export interface RolePermissions {
  [module: string]: { [action: string]: boolean };
}

export interface Role {
  id: string;
  account_id: string;
  name: string;
  rank: number;
  is_system: boolean;
  permissions: RolePermissions;
  created_at: string;
  updated_at: string;
}
