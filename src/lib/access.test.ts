import { describe, expect, it } from "vitest";
import type { CatalogModule, GrantSet, RoleTemplate } from "../api/types";
import { computeEffective, derivedRoles, scopeAllows } from "./access";

const perm = (moduleKey: string, name: string, group: CatalogModule["permissions"][number]["group"] = "REPORT") => ({
  key: `${moduleKey}:${name}`,
  moduleKey,
  displayName: name,
  group,
  sensitive: false,
});

const catalog: CatalogModule[] = [
  { key: "shared", displayName: "Shared", order: 0, permissions: [perm("shared", "profile", "SHARED")] },
  { key: "registrar", displayName: "Registrar", order: 1, permissions: [perm("registrar", "a"), perm("registrar", "b")] },
  { key: "admin", displayName: "Admin", order: 2, permissions: [perm("admin", "users")] },
  { key: "student", displayName: "Student", order: 3, permissions: [perm("student", "portal")] },
];

const none: GrantSet = { moduleKeys: [], excludedPermissionKeys: [], permissionKeys: [], roleTemplateKeys: [] };

describe("computeEffective", () => {
  it("always includes the shared group", () => {
    expect(computeEffective(catalog, [], none, "LECTURER")).toEqual(["shared:profile"]);
  });

  it("applies whole modules minus exclusions, plus individual picks", () => {
    const grants = { ...none, moduleKeys: ["registrar"], excludedPermissionKeys: ["registrar:b"], permissionKeys: ["x:y"] };
    expect(computeEffective(catalog, [], grants, "LECTURER")).toEqual(["registrar:a", "shared:profile", "x:y"]);
  });

  it("follows template parents and survives a cycle", () => {
    const templates: RoleTemplate[] = [
      { id: "1", key: "child", displayName: "Child", permissionKeys: ["registrar:a"], parentKey: "parent" },
      { id: "2", key: "parent", displayName: "Parent", permissionKeys: ["registrar:b"], parentKey: "child" },
    ];
    expect(computeEffective(catalog, templates, { ...none, roleTemplateKeys: ["child"] }, "LECTURER")).toEqual([
      "registrar:a",
      "registrar:b",
      "shared:profile",
    ]);
  });

  it("drops admin:* off non-admins and student:* off non-students", () => {
    const grants = { ...none, moduleKeys: ["admin", "student"] };
    expect(computeEffective(catalog, [], grants, "REGISTRAR")).toEqual(["shared:profile"]);
    expect(computeEffective(catalog, [], grants, "ADMIN")).toContain("admin:users");
    expect(computeEffective(catalog, [], grants, "STUDENT")).toContain("student:portal");
  });
});

describe("derivedRoles", () => {
  it("lists office roles implied by module permissions, not the account's own", () => {
    expect(derivedRoles(["registrar:a", "business:x", "dean:y"], "LECTURER")).toEqual(["REGISTRAR", "FINANCE"]);
    expect(derivedRoles(["registrar:a"], "REGISTRAR")).toEqual([]);
  });
});

describe("scopeAllows", () => {
  it("guards module keys as well as permission keys", () => {
    expect(scopeAllows("admin", "LECTURER")).toBe(false);
    expect(scopeAllows("student", "STUDENT")).toBe(true);
    expect(scopeAllows("registrar:a", undefined)).toBe(true);
  });
});
