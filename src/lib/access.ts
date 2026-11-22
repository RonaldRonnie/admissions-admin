import type { CatalogModule, GrantSet, RoleTemplate, UserRole } from "../api/types";

/**
 * AccessGrantService.MODULE_ROLE_MAP: holding any permission under one of these modules also gives
 * the account that office's role on sign-in. The other modules are permission-only.
 */
export const MODULE_ROLE_MAP: Record<string, UserRole> = {
  admin: "ADMIN",
  admissions: "ADMISSIONS_OFFICER",
  registrar: "REGISTRAR",
  business: "FINANCE",
  student: "STUDENT",
};

/**
 * AccessGrantService.ROLE_DEFAULT_MODULES: the modules an account starts with when it is created,
 * approved or moved into the role - unless an admin has already picked that module's permissions.
 */
export const ROLE_DEFAULT_MODULES: Partial<Record<UserRole, string[]>> = {
  FINANCE: ["business"],
  ADMISSIONS_OFFICER: ["admissions"],
  REGISTRAR: ["registrar", "general"],
  STUDENT: ["student"],
};

/** admin:* is only effective on an ADMIN account, student:* only on a STUDENT account. */
export function scopeAllows(key: string, role: UserRole | undefined): boolean {
  if (key === "admin" || key.startsWith("admin:")) return role === "ADMIN";
  if (key === "student" || key.startsWith("student:")) return role === "STUDENT";
  return true;
}

function templatePermissions(templates: RoleTemplate[], key: string): string[] {
  const byKey = new Map(templates.map((t) => [t.key, t]));
  const out: string[] = [];
  const seen = new Set<string>();
  let current = byKey.get(key);
  // Follow the parentKey chain, guarding against a cycle the way resolveWithAncestors does.
  while (current && !seen.has(current.key)) {
    seen.add(current.key);
    out.push(...current.permissionKeys);
    current = current.parentKey ? byKey.get(current.parentKey) : undefined;
  }
  return out;
}

/**
 * What AccessGrantService#getEffectivePermissions would compute for these grants: the SHARED
 * group, granted modules minus exclusions, individual picks and role templates (with parents),
 * then the admin/student scope rule for the account's role.
 */
export function computeEffective(catalog: CatalogModule[], templates: RoleTemplate[], grants: GrantSet, role: UserRole | undefined): string[] {
  const effective = new Set<string>();
  const excluded = new Set(grants.excludedPermissionKeys);
  for (const module of catalog) {
    const whole = grants.moduleKeys.includes(module.key);
    for (const p of module.permissions) {
      if (p.group === "SHARED" || (whole && !excluded.has(p.key))) effective.add(p.key);
    }
  }
  grants.permissionKeys.forEach((k) => effective.add(k));
  grants.roleTemplateKeys.forEach((t) => templatePermissions(templates, t).forEach((k) => effective.add(k)));
  return [...effective].filter((k) => scopeAllows(k, role)).sort();
}

/** The office roles these effective permissions add on top of the account's own role. */
export function derivedRoles(effective: string[], role: UserRole | undefined): UserRole[] {
  return Object.entries(MODULE_ROLE_MAP)
    .filter(([module, derived]) => derived !== role && effective.some((k) => k.startsWith(`${module}:`)))
    .map(([, derived]) => derived);
}
