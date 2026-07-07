"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  canDo as canDoBase,
  getDefaultPermissions,
  getAccessibleModules as getAccessibleModulesBase,
} from "@/lib/auth/roles";
import type { Role, RolePermissions } from "@/types";

interface UseRolePermissionsResult {
  roles: Role[];
  userRole: Role | null;
  userPermissions: RolePermissions;
  loading: boolean;
  canDo: (module: string, action: string) => boolean;
  canAccessModule: (module: string) => boolean;
  getAccessibleModules: () => string[];
  refreshRoles: () => Promise<void>;
}

/**
 * Hook that fetches configurable roles from BD and provides
 * permission checking functions for the current user.
 *
 * Falls back to hardcoded defaults when no roles exist in BD.
 * Owner always gets full access regardless of configured permissions.
 */
export function useRolePermissions(): UseRolePermissionsResult {
  const { accountId, accountRole, profileLoading } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (profileLoading) return;
    let cancelled = false;
    async function load() {
      if (!accountId || !accountRole) {
        if (!cancelled) {
          setRoles([]);
          setLoading(false);
        }
        return;
      }
      if (accountRole === 'owner') {
        if (!cancelled) {
          setRoles([]);
          setLoading(false);
        }
        return;
      }
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('roles')
          .select('*')
          .eq('account_id', accountId)
          .order('rank', { ascending: false });
        if (!cancelled) {
          if (error) {
            console.error('[useRolePermissions] fetch error:', error.message);
            setRoles([]);
          } else {
            setRoles(data ?? []);
          }
        }
      } catch (err) {
        console.error('[useRolePermissions] fetch threw:', err);
        if (!cancelled) setRoles([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [profileLoading, accountId, accountRole, refreshKey]);

  const userRole = useMemo(() => {
    if (!accountRole || roles.length === 0) return null;
    return roles.find((r) => {
      const rankMap: Record<string, number> = {
        owner: 10, admin: 8, agent: 5, viewer: 1,
      };
      return r.rank === rankMap[accountRole];
    }) ?? null;
  }, [accountRole, roles]);

  const userPermissions: RolePermissions = useMemo(() => {
    if (userRole) return userRole.permissions;
    if (accountRole) return getDefaultPermissions(accountRole);
    return {};
  }, [userRole, accountRole]);

  const canDo = useCallback(
    (module: string, action: string): boolean => {
      if (!accountRole) return false;
      return canDoBase(accountRole, userPermissions, module, action);
    },
    [accountRole, userPermissions],
  );

  const canAccessModule = useCallback(
    (module: string): boolean => {
      if (!accountRole) return false;
      if (accountRole === 'owner') return true;
      return userPermissions[module]?.view === true;
    },
    [accountRole, userPermissions],
  );

  const getAccessibleModules = useCallback(
    (): string[] => {
      if (!accountRole) return [];
      return getAccessibleModulesBase(accountRole, userPermissions);
    },
    [accountRole, userPermissions],
  );

  return {
    roles,
    userRole,
    userPermissions,
    loading: loading || profileLoading,
    canDo,
    canAccessModule,
    getAccessibleModules,
    refreshRoles: useCallback(() => {
      setRefreshKey((k) => k + 1);
      return Promise.resolve();
    }, []),
  };
}
