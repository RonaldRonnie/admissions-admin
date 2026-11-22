import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCatalog, getUser, getUserGrants, listRoleTemplates, setUserGrants } from "../api/endpoints";
import { ROLE_LABELS, type GrantSet } from "../api/types";
import { EMPTY_GRANTS, GrantsEditor } from "../components/GrantsEditor";
import { Badge, Button, ErrorBanner, Loading, PageHeader } from "../components/ui";
import { useToast } from "../components/Toast";
import { computeEffective, derivedRoles, ROLE_DEFAULT_MODULES } from "../lib/access";
import { formatDateTime, fullName } from "../lib/format";

function sameGrants(a: GrantSet, b: GrantSet): boolean {
  const eq = (x: string[], y: string[]) => x.length === y.length && [...x].sort().join() === [...y].sort().join();
  return (
    eq(a.moduleKeys, b.moduleKeys) &&
    eq(a.excludedPermissionKeys, b.excludedPermissionKeys) &&
    eq(a.permissionKeys, b.permissionKeys) &&
    eq(a.roleTemplateKeys, b.roleTemplateKeys)
  );
}

export function UserAccessPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();

  const user = useQuery({ queryKey: ["users", id], queryFn: () => getUser(id) });
  const grants = useQuery({ queryKey: ["grants", id], queryFn: () => getUserGrants(id) });
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: () => getCatalog() });
  const templates = useQuery({ queryKey: ["role-templates"], queryFn: listRoleTemplates });

  const saved: GrantSet = useMemo(
    () =>
      grants.data
        ? {
            moduleKeys: grants.data.moduleKeys ?? [],
            excludedPermissionKeys: grants.data.excludedPermissionKeys ?? [],
            permissionKeys: grants.data.permissionKeys ?? [],
            roleTemplateKeys: grants.data.roleTemplateKeys ?? [],
          }
        : EMPTY_GRANTS,
    [grants.data],
  );
  const [draft, setDraft] = useState<GrantSet>(EMPTY_GRANTS);
  useEffect(() => setDraft(saved), [saved]);
  const dirty = !sameGrants(draft, saved);

  const mutation = useMutation({
    mutationFn: () => setUserGrants(id, draft),
    onSuccess: (result) => {
      queryClient.setQueryData(["grants", id], result);
      queryClient.invalidateQueries({ queryKey: ["audit"] });
      toast.success("Access saved. It applies from their next request; no sign-out needed.");
    },
    onError: (error) => toast.error(error),
  });

  const loading = user.isLoading || grants.isLoading || catalog.isLoading || templates.isLoading;
  const error = user.error ?? grants.error ?? catalog.error ?? templates.error;
  const role = user.data?.role;
  const savedEffective = useMemo(() => new Set(grants.data?.effectivePermissionKeys ?? []), [grants.data]);
  // The server's computation is the truth once saved; while editing, preview the same rule here.
  const effective = useMemo(
    () => (dirty ? computeEffective(catalog.data ?? [], templates.data ?? [], draft, role) : [...savedEffective].sort()),
    [dirty, catalog.data, templates.data, draft, role, savedEffective],
  );
  const added = dirty ? effective.filter((k) => !savedEffective.has(k)) : [];
  const removed = dirty ? [...savedEffective].filter((k) => !effective.includes(k)).sort() : [];
  const derived = derivedRoles(effective, role);
  const defaults = role ? (ROLE_DEFAULT_MODULES[role] ?? []) : [];
  const moduleName = (key: string) => catalog.data?.find((m) => m.key === key)?.displayName ?? key;

  return (
    <>
      <p className="mb-2 text-sm">
        <Link to="/users" className="text-brand-700 hover:underline">
          ← Users
        </Link>
      </p>
      <PageHeader
        title={user.data ? `Access for ${fullName(user.data)}` : "Access"}
        description={
          user.data && (
            <>
              {user.data.email} · {ROLE_LABELS[user.data.role]}. Permissions on top of the role. Granting anything under a module such as
              Registrar or Admissions also gives them that office's role.
            </>
          )
        }
        actions={
          <>
            <Button disabled={!dirty || mutation.isPending} onClick={() => setDraft(saved)}>
              Discard changes
            </Button>
            <Button variant="primary" disabled={!dirty} busy={mutation.isPending} onClick={() => mutation.mutate()}>
              Save access
            </Button>
          </>
        }
      />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBanner error={error} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
          <div className="card p-5">
            <GrantsEditor
              catalog={catalog.data ?? []}
              templates={templates.data ?? []}
              value={draft}
              onChange={setDraft}
              allowAdminScope={role === "ADMIN"}
              allowStudentScope={role === "STUDENT"}
            />
          </div>
          <aside className="card h-fit space-y-4 p-5 xl:sticky xl:top-8">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">{dirty ? "Effective permissions (preview)" : "Effective permissions"}</h3>
              <p className="mt-1 text-xs text-slate-500">
                {dirty
                  ? "What they will hold once you save, worked out with the server's rule. Saving shows the server's own result."
                  : "What the server computes from the saved grants, including always-on shared permissions."}
                {!dirty && grants.data?.updatedAt ? ` Last changed ${formatDateTime(grants.data.updatedAt)}.` : ""}
              </p>
              <p className="mt-3 flex flex-wrap items-baseline gap-2">
                <span className="text-2xl font-semibold">{effective.length}</span>
                {added.length > 0 && <Badge tone="green">+{added.length}</Badge>}
                {removed.length > 0 && <Badge tone="red">−{removed.length}</Badge>}
              </p>
            </div>
            {derived.length > 0 && (
              <p className="text-xs text-slate-600">
                Also signs in as: {derived.map((r) => <Badge key={r} tone="blue">{ROLE_LABELS[r]}</Badge>)}
              </p>
            )}
            {defaults.length > 0 && (
              <p className="rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                {ROLE_LABELS[role!]} accounts start with {defaults.map(moduleName).join(" and ")} when created, approved or moved into the role,
                unless that module's permissions were already picked here.
              </p>
            )}
            <ul className="max-h-96 space-y-0.5 overflow-y-auto text-xs">
              {removed.map((key) => (
                <li key={key} className="text-red-700 line-through">
                  <code>{key}</code>
                </li>
              ))}
              {effective.map((key) => (
                <li key={key} className={added.includes(key) ? "font-medium text-emerald-700" : undefined}>
                  <code>{key}</code>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </>
  );
}
