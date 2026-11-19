import { useMemo, useState } from "react";
import type { CatalogModule } from "../api/types";
import { Badge, Checkbox } from "./ui";

/** Picks individual permission keys, grouped by module. Used for role templates. */
export function PermissionPicker({
  catalog,
  value,
  onChange,
}: {
  catalog: CatalogModule[];
  value: string[];
  onChange: (keys: string[]) => void;
}) {
  const [filter, setFilter] = useState("");
  const selected = useMemo(() => new Set(value), [value]);
  const needle = filter.trim().toLowerCase();

  function set(keys: string[], on: boolean) {
    const next = new Set(selected);
    keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
    onChange([...next]);
  }

  return (
    <div className="space-y-3">
      <input className="input" placeholder="Filter permissions…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <div className="max-h-[45vh] space-y-4 overflow-y-auto rounded-md border border-slate-200 p-3">
        {[...catalog]
          .sort((a, b) => a.order - b.order)
          .map((module) => {
            const perms = module.permissions.filter(
              (p) => !needle || p.displayName.toLowerCase().includes(needle) || p.key.toLowerCase().includes(needle),
            );
            if (perms.length === 0) return null;
            const keys = perms.map((p) => p.key);
            const allOn = keys.every((k) => selected.has(k));
            return (
              <div key={module.key}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-800">{module.displayName}</span>
                  <button type="button" className="text-xs text-brand-700 hover:underline" onClick={() => set(keys, !allOn)}>
                    {allOn ? "Clear" : "Select all"}
                  </button>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {perms.map((p) => (
                    <Checkbox
                      key={p.key}
                      checked={selected.has(p.key)}
                      onChange={(on) => set([p.key], on)}
                      label={
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          {p.displayName}
                          {p.sensitive && <Badge tone="red">sensitive</Badge>}
                        </span>
                      }
                      description={<code className="text-[11px]">{p.key}</code>}
                    />
                  ))}
                </div>
              </div>
            );
          })}
      </div>
      <p className="text-xs text-slate-500">{value.length} selected</p>
    </div>
  );
}
