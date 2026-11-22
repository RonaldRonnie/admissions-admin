import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError, apiBaseUrl } from "../../api/client";
import { adminHealth, databaseHealth, getCatalog, listAcademicYears, listUsers } from "../../api/endpoints";
import { Badge, Button, PageHeader, Spinner } from "../../components/ui";
import { formatDateTime } from "../../lib/format";

function Check({ title, state, children }: { title: string; state: "ok" | "down" | "warn" | "loading"; children: ReactNode }) {
  const badge =
    state === "loading" ? (
      <Spinner className="h-4 w-4 text-slate-400" />
    ) : state === "ok" ? (
      <Badge tone="green">OK</Badge>
    ) : state === "warn" ? (
      <Badge tone="amber">Check</Badge>
    ) : (
      <Badge tone="red">Down</Badge>
    );
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-800">{title}</h2>
        {badge}
      </div>
      <div className="mt-2 space-y-1 text-sm text-slate-600">{children}</div>
    </div>
  );
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Is the API up, is PostgreSQL answering, and is the institution's basic setup in place? */
export function SystemHealthPage() {
  const opts = { refetchInterval: 30_000, retry: false } as const;
  const api = useQuery({ queryKey: ["health", "api"], queryFn: adminHealth, ...opts });
  const db = useQuery({ queryKey: ["health", "db"], queryFn: databaseHealth, ...opts });
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: () => getCatalog() });
  const users = useQuery({ queryKey: ["users", "all"], queryFn: listUsers });
  const years = useQuery({ queryKey: ["academic-years"], queryFn: listAcademicYears });

  const permissionCount = (catalog.data ?? []).reduce((n, m) => n + m.permissions.length, 0);
  const admins = (users.data ?? []).filter((u) => u.role === "ADMIN" && u.enabled).length;
  const currentYear = years.data?.find((y) => y.current);
  // The database endpoint answers 503 with its details when PostgreSQL is unreachable.
  const dbDown = db.error instanceof ApiError && db.error.status === 503;

  return (
    <>
      <PageHeader
        title="System health"
        description="Live checks against the API this panel is connected to. Refreshes every 30 seconds."
        actions={
          <Button
            onClick={() => {
              api.refetch();
              db.refetch();
            }}
          >
            Check now
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Check title="API server" state={api.isLoading ? "loading" : api.data ? "ok" : "down"}>
          <p>
            <code className="text-xs break-all">{apiBaseUrl() || "(VITE_API_BASE_URL is not set)"}</code>
          </p>
          {api.data && (
            <p>
              {api.data.message} · answered {formatDateTime(new Date(api.data.timestamp).toISOString())}
            </p>
          )}
          {api.error && <p className="text-red-700">{message(api.error)}</p>}
        </Check>
        <Check title="Database" state={db.isLoading ? "loading" : db.data?.status === "UP" ? "ok" : "down"}>
          {db.data && (
            <p>
              {String(db.data.details.database ?? "PostgreSQL")} · {String(db.data.details.status ?? db.data.status)}
              {db.data.details.databaseName ? ` · ${String(db.data.details.databaseName)}` : ""}
            </p>
          )}
          {db.error && <p className="text-red-700">{dbDown ? "PostgreSQL is not answering the API." : message(db.error)}</p>}
        </Check>
        <Check title="Permission catalog" state={catalog.isLoading ? "loading" : permissionCount > 0 ? "ok" : "warn"}>
          <p>
            {catalog.data?.length ?? 0} modules, {permissionCount} permissions. The server re-seeds the catalog on every start.
          </p>
        </Check>
        <Check title="Accounts" state={users.isLoading ? "loading" : admins >= 2 ? "ok" : "warn"}>
          <p>
            {users.data?.length ?? 0} accounts, {admins} enabled administrator{admins === 1 ? "" : "s"}.
          </p>
          {!users.isLoading && admins < 2 && <p className="text-amber-700">Keep a second administrator so a lost password doesn't lock everyone out.</p>}
        </Check>
        <Check title="Academic calendar" state={years.isLoading ? "loading" : currentYear ? "ok" : "warn"}>
          {currentYear ? (
            <p>Current academic year: {currentYear.name}.</p>
          ) : (
            <p className="text-amber-700">No current academic year. Set one under Academic calendar; registration and fees use it.</p>
          )}
        </Check>
        <Check title="This panel" state="ok">
          <p>Built {import.meta.env.MODE === "production" ? "for production" : `in ${import.meta.env.MODE} mode`}.</p>
          <p>Signed-in sessions last for the browser tab only.</p>
        </Check>
      </div>
    </>
  );
}
