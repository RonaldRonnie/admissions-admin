import { useDeferredValue, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getCatalog } from "../api/endpoints";
import { PERMISSION_GROUPS, type PermissionGroup } from "../api/types";
import { Badge, EmptyState, ErrorBanner, Loading, PageHeader } from "../components/ui";
import { humanize } from "../lib/format";

export function CatalogPage() {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<PermissionGroup | "">("");
  const [sensitiveOnly, setSensitiveOnly] = useState(false);
  const query = useDeferredValue(q.trim());

  const filters = { q: query || undefined, group: group || undefined, sensitive: sensitiveOnly || undefined };
  const catalog = useQuery({
    queryKey: ["catalog", filters],
    queryFn: () => getCatalog(filters),
    placeholderData: keepPreviousData,
  });

  const modules = (catalog.data ?? []).filter((m) => m.permissions.length > 0).sort((a, b) => a.order - b.order);
  const total = modules.reduce((n, m) => n + m.permissions.length, 0);

  return (
    <>
      <PageHeader
        title="Permission catalog"
        description="Every permission the system knows about, by dashboard module. The catalog is defined in code (PermissionCatalogSeeder); grant from a user's Access page or through a role template."
      />
      <div className="card mb-6 flex flex-wrap items-center gap-3 p-4">
        <input className="input max-w-xs" placeholder="Search permissions…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-auto" value={group} onChange={(e) => setGroup(e.target.value as PermissionGroup | "")} aria-label="Group">
          <option value="">All groups</option>
          {PERMISSION_GROUPS.map((g) => (
            <option key={g} value={g}>
              {humanize(g)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-brand-700" checked={sensitiveOnly} onChange={(e) => setSensitiveOnly(e.target.checked)} />
          Sensitive only
        </label>
        {catalog.data && (
          <span className="ml-auto text-sm text-slate-500">
            {total} permission{total === 1 ? "" : "s"} in {modules.length} module{modules.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {catalog.isLoading ? (
        <Loading />
      ) : catalog.error ? (
        <ErrorBanner error={catalog.error} onRetry={() => catalog.refetch()} />
      ) : modules.length === 0 ? (
        <div className="card">
          <EmptyState title="No permissions match." />
        </div>
      ) : (
        <div className="space-y-4">
          {modules.map((m) => (
            <section key={m.key} className="card">
              <header className="border-b border-slate-200 px-4 py-3">
                <h2 className="font-semibold">
                  {m.displayName} <code className="ml-1 text-xs font-normal text-slate-500">{m.key}</code>
                </h2>
                {m.description && <p className="text-sm text-slate-600">{m.description}</p>}
              </header>
              <ul className="divide-y divide-slate-100">
                {m.permissions.map((p) => (
                  <li key={p.key} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800">{p.displayName}</p>
                      {p.description && <p className="text-xs text-slate-500">{p.description}</p>}
                    </div>
                    <code className="text-xs text-slate-600">{p.key}</code>
                    <div className="flex gap-1.5">
                      <Badge>{humanize(p.group)}</Badge>
                      {p.sensitive && <Badge tone="red">Sensitive</Badge>}
                      {p.group === "SHARED" && <Badge tone="blue">Always on</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
