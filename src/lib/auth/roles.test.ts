import { describe, expect, it } from "vitest";
import {
  ACCOUNT_ROLES,
  type AccountRole,
  canDeleteAccount,
  canDo,
  canEditSettings,
  canManageMembers,
  canSendMessages,
  canTransferOwnership,
  canViewOnly,
  getDefaultPermissions,
  getAccessibleModules,
  hasMinRole,
  isAccountRole,
  roleRank,
} from "./roles";
import type { RolePermissions } from "@/types";

describe("roleRank", () => {
  it("orders owner > admin > agent > viewer", () => {
    expect(roleRank("owner")).toBeGreaterThan(roleRank("admin"));
    expect(roleRank("admin")).toBeGreaterThan(roleRank("agent"));
    expect(roleRank("agent")).toBeGreaterThan(roleRank("viewer"));
  });

  it("matches the SQL helper's numeric mapping", () => {
    // Keep these in lockstep with `is_account_member`'s CASE expression
    // in supabase/migrations/017_account_sharing.sql — any change here
    // means the SQL helper needs the same change.
    expect(roleRank("owner")).toBe(4);
    expect(roleRank("admin")).toBe(3);
    expect(roleRank("agent")).toBe(2);
    expect(roleRank("viewer")).toBe(1);
  });
});

describe("hasMinRole", () => {
  it("returns true when role meets the threshold", () => {
    expect(hasMinRole("owner", "viewer")).toBe(true);
    expect(hasMinRole("admin", "agent")).toBe(true);
    expect(hasMinRole("agent", "agent")).toBe(true);
  });

  it("returns false when role is below the threshold", () => {
    expect(hasMinRole("viewer", "agent")).toBe(false);
    expect(hasMinRole("agent", "admin")).toBe(false);
    expect(hasMinRole("admin", "owner")).toBe(false);
  });

  // The full matrix — useful as a regression net if anyone reshuffles
  // the rank table.
  it.each<[AccountRole, AccountRole, boolean]>([
    ["owner", "owner", true],
    ["owner", "admin", true],
    ["owner", "agent", true],
    ["owner", "viewer", true],
    ["admin", "owner", false],
    ["admin", "admin", true],
    ["admin", "agent", true],
    ["admin", "viewer", true],
    ["agent", "owner", false],
    ["agent", "admin", false],
    ["agent", "agent", true],
    ["agent", "viewer", true],
    ["viewer", "owner", false],
    ["viewer", "admin", false],
    ["viewer", "agent", false],
    ["viewer", "viewer", true],
  ])("%s vs min %s → %s", (role, min, expected) => {
    expect(hasMinRole(role, min)).toBe(expected);
  });
});

describe("isAccountRole", () => {
  it("accepts every value in ACCOUNT_ROLES", () => {
    for (const role of ACCOUNT_ROLES) {
      expect(isAccountRole(role)).toBe(true);
    }
  });

  it("rejects garbage / case mismatch / non-strings", () => {
    expect(isAccountRole("Owner")).toBe(false);
    expect(isAccountRole("")).toBe(false);
    expect(isAccountRole(null)).toBe(false);
    expect(isAccountRole(undefined)).toBe(false);
    expect(isAccountRole(123)).toBe(false);
    expect(isAccountRole("superuser")).toBe(false);
  });
});

describe("capability predicates", () => {
  it("canManageMembers: admin+ only", () => {
    expect(canManageMembers("owner")).toBe(true);
    expect(canManageMembers("admin")).toBe(true);
    expect(canManageMembers("agent")).toBe(false);
    expect(canManageMembers("viewer")).toBe(false);
  });

  it("canEditSettings: admin+ only", () => {
    expect(canEditSettings("owner")).toBe(true);
    expect(canEditSettings("admin")).toBe(true);
    expect(canEditSettings("agent")).toBe(false);
    expect(canEditSettings("viewer")).toBe(false);
  });

  it("canSendMessages: agent+ only", () => {
    expect(canSendMessages("owner")).toBe(true);
    expect(canSendMessages("admin")).toBe(true);
    expect(canSendMessages("agent")).toBe(true);
    expect(canSendMessages("viewer")).toBe(false);
  });

  it("canViewOnly: viewer only", () => {
    expect(canViewOnly("owner")).toBe(false);
    expect(canViewOnly("admin")).toBe(false);
    expect(canViewOnly("agent")).toBe(false);
    expect(canViewOnly("viewer")).toBe(true);
  });

  it("canDeleteAccount: owner only", () => {
    expect(canDeleteAccount("owner")).toBe(true);
    expect(canDeleteAccount("admin")).toBe(false);
    expect(canDeleteAccount("agent")).toBe(false);
    expect(canDeleteAccount("viewer")).toBe(false);
  });

  it("canTransferOwnership: owner only", () => {
    expect(canTransferOwnership("owner")).toBe(true);
    expect(canTransferOwnership("admin")).toBe(false);
    expect(canTransferOwnership("agent")).toBe(false);
    expect(canTransferOwnership("viewer")).toBe(false);
  });
});

describe("canDo (configurable permissions)", () => {
  const adminPerms: RolePermissions = {
    dashboard: { view: true },
    contacts: { view: true, create: true, edit: true, delete: false },
    settings: { whatsapp: true, roles: false },
  };

  it("owner always returns true regardless of permissions", () => {
    expect(canDo("owner", {}, "anything", "anything")).toBe(true);
    expect(canDo("owner", adminPerms, "contacts", "delete")).toBe(true);
  });

  it("returns true when permission is explicitly true", () => {
    expect(canDo("admin", adminPerms, "dashboard", "view")).toBe(true);
    expect(canDo("admin", adminPerms, "contacts", "create")).toBe(true);
  });

  it("returns false when permission is explicitly false", () => {
    expect(canDo("admin", adminPerms, "contacts", "delete")).toBe(false);
    expect(canDo("admin", adminPerms, "settings", "roles")).toBe(false);
  });

  it("returns false when module is missing", () => {
    expect(canDo("admin", adminPerms, "broadcasts", "view")).toBe(false);
  });

  it("returns false when action is missing", () => {
    expect(canDo("admin", adminPerms, "dashboard", "create")).toBe(false);
  });

  it("returns false for empty permissions", () => {
    expect(canDo("agent", {}, "dashboard", "view")).toBe(false);
  });
});

describe("getDefaultPermissions", () => {
  it("owner gets all permissions true", () => {
    const perms = getDefaultPermissions("owner");
    expect(perms.dashboard?.view).toBe(true);
    expect(perms.inbox?.send).toBe(true);
    expect(perms.contacts?.delete).toBe(true);
    expect(perms.settings?.roles).toBe(true);
    expect(perms.settings?.whatsapp).toBe(true);
  });

  it("admin gets all except roles", () => {
    const perms = getDefaultPermissions("admin");
    expect(perms.dashboard?.view).toBe(true);
    expect(perms.settings?.roles).toBe(false);
    expect(perms.settings?.whatsapp).toBe(true);
  });

  it("agent gets operational only", () => {
    const perms = getDefaultPermissions("agent");
    expect(perms.dashboard?.view).toBe(true);
    expect(perms.inbox?.send).toBe(true);
    expect(perms.contacts?.create).toBe(true);
    expect(perms.contacts?.delete).toBe(false);
    expect(perms.automations?.view).toBe(false);
    expect(perms.settings?.whatsapp).toBe(false);
  });

  it("viewer gets view-only", () => {
    const perms = getDefaultPermissions("viewer");
    expect(perms.dashboard?.view).toBe(true);
    expect(perms.inbox?.send).toBe(false);
    expect(perms.contacts?.create).toBe(false);
    expect(perms.pipelines?.move_deals).toBe(false);
  });
});

describe("getAccessibleModules", () => {
  it("owner gets all modules", () => {
    const modules = getAccessibleModules("owner", {});
    expect(modules).toContain("dashboard");
    expect(modules).toContain("inbox");
    expect(modules).toContain("settings");
    expect(modules).toContain("flows");
  });

  it("returns modules with view=true", () => {
    const perms: RolePermissions = {
      dashboard: { view: true },
      contacts: { view: true },
      automations: { view: false },
    };
    const modules = getAccessibleModules("agent", perms);
    expect(modules).toContain("dashboard");
    expect(modules).toContain("contacts");
    expect(modules).not.toContain("automations");
  });

  it("returns empty for empty permissions", () => {
    const modules = getAccessibleModules("agent", {});
    expect(modules).toEqual([]);
  });
});
