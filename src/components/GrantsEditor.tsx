import { useMemo, useState } from "react";
import type { CatalogModule, GrantSet, Permission, RoleTemplate } from "../api/types";
import { Badge, Checkbox } from "./ui";

export const EMPTY_GRANTS: GrantSet = { moduleKeys: [], excludedPermissionKeys: [], permissionKeys: [], roleTemplateKeys: [] };

const ADMIN_MODULE = "admin";
const STUDENT_MODULE = "student";
const isAdminKey = (key: string) => key.startsWith("admin:");
const isStudentKey = (key: string) => key.startsWith("student:");

function toggle(list: string[], key: string, on: boolean): string[] {
  const without = list.filter((k) => k !== key);
  return on ? [...without, key] : without;
}

/**
 * Edits the four parts of a UserAccessGrant the way AccessGrantService reads them:
 * whole modules (minus exclusions), individual permissions, and role templates. SHARED-group
 * permissions are always effective, so they're shown on and locked.
 */
export function GrantsEditor({
  catalog,
  templates,
  value,
  onChange,
  allowAdminScope,
  allowStudentScope = true,
}: {
  catalog: CatalogModule[];
  templates: RoleTemplate[];
  value: GrantSet;
  onChange: (next: GrantSet) => void;
  /** The backend refuses admin:* grants for anyone whose role is not ADMIN. */
  allowAdminScope: boolean;
  /** ...and student:* grants for anyone whose role is not STUDENT (validateStudentScope). */
  allowStudentScope?: boolean;
}) {
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const modules = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return [...catalog]
      .sort((a, b) => a.order - b.order)
      .map((module) => ({
        module,
        permissions: needle
          ? module.permissions.filter(
              (p) => p.displayName.toLowerCase().includes(needle) || p.key.toLowerCase().includes(needle),
            )
          : module.permissions,
      }))
      .filter(({ module, permissions }) => !needle || permissions.length > 0 || module.displayName.toLowerCase().includes(needle));
  }, [catalog, filter]);

  function isOn(permission: Permission): boolean {
    if (permission.group === "SHARED") return true;
    if (value.moduleKeys.includes(permission.moduleKey)) return !value.excludedPermissionKeys.includes(permission.key);
    return value.permissionKeys.includes(permission.key);
  }

  function setPermission(permission: Permission, on: boolean) {
    if (value.moduleKeys.includes(permission.moduleKey)) {
      onChange({ ...value, excludedPermissionKeys: toggle(value.excludedPermissionKeys, permission.key, !on) });
    } else {
      onChange({ ...value, permissionKeys: toggle(value.permissionKeys, permission.key, on) });
    }
  }

  function setModule(module: CatalogModule, on: boolean) {
    const keys = new Set(module.permissions.map((p) => p.key));
    onChange({
      ...value,
      moduleKeys: toggle(value.moduleKeys, module.key, on),
      // Whole-module and per-permission state for the same module would be redundant; start clean.
      excludedPermissionKeys: value.excludedPermissionKeys.filter((k) => !keys.has(k)),
      permissionKeys: value.permissionKeys.filter((k) => !keys.has(k)),
    });
  }

  const lockReason = (key: string): string | null => {
    if (!allowAdminScope && (key === ADMIN_MODULE || isAdminKey(key))) return "ADMIN-role accounts only";
    if (!allowStudentScope && (key === STUDENT_MODULE || isStudentKey(key))) return "STUDENT accounts only";
    return null;
  };

  return (
    <div className="space-y-6">
      {templates.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Role templates</h3>
          <p className="mb-3 text-xs text-slate-500">Reusable bundles. A template's permissions (and its parent's) are added on top of everything below.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {templates.map((t) => {
              const reason = t.permissionKeys.map(lockReason).find(Boolean);
              const locked = Boolean(reason);
              return (
                <Checkbox
                  key={t.key}
                  label={t.displayName}
                  description={locked ? `Contains permissions for ${reason}` : t.description || t.key}
                  checked={value.roleTemplateKeys.includes(t.key)}
                  disabled={locked && !value.roleTemplateKeys.includes(t.key)}
                  onChange={(on) => onChange({ ...value, roleTemplateKeys: toggle(value.roleTemplateKeys, t.key, on) })}
                />
              );
            })}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">Modules and permissions</h3>
          <input className="input max-w-xs" placeholder="Filter permissions…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <div className="divide-y divide-slate-200 rounded-md border border-slate-200">
          {modules.map(({ module, permissions }) => {
            const whole = value.moduleKeys.includes(module.key);
            const onCount = module.permissions.filter(isOn).length;
            const expanded = open[module.key] ?? filter.trim() !== "";
            const locked = lockReason(module.key);
            return (
              <div key={module.key}>
                <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => setOpen((o) => ({ ...o, [module.key]: !expanded }))}
                    aria-expanded={expanded}
                  >
                    <span className="w-3 text-slate-400">{expanded ? "▾" : "▸"}</span>
                    <span className="min-w-0">
                      <span className="font-medium text-slate-800">{module.displayName}</span>{" "}
                      <span className="text-xs text-slate-500">
                        {onCount}/{module.permissions.length} on
                      </span>
                      {module.description && <span className="block truncate text-xs text-slate-500">{module.description}</span>}
                    </span>
                  </button>
                  {/* A locked module already granted stays untickable, so it can be taken away. */}
                  {locked && !whole ? (
                    <Badge>{locked}</Badge>
                  ) : (
                    <Checkbox label="Whole module" checked={whole} onChange={(on) => setModule(module, on)} />
                  )}
                </div>
                {expanded && (
                  <div className="grid gap-x-6 gap-y-2 bg-slate-50 px-9 py-3 sm:grid-cols-2">
                    {permissions.map((p) => (
                      <Checkbox
                        key={p.key}
                        checked={isOn(p)}
                        disabled={p.group === "SHARED" || (Boolean(lockReason(p.key)) && !isOn(p))}
                        onChange={(on) => setPermission(p, on)}
                        label={
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            {p.displayName}
                            {p.sensitive && <Badge tone="red">sensitive</Badge>}
                            {p.group === "SHARED" && <Badge tone="blue">always on</Badge>}
                          </span>
                        }
                        description={<code className="text-[11px]">{p.key}</code>}
                      />
                    ))}
                    {permissions.length === 0 && <p className="text-xs text-slate-500">No permissions match the filter.</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
