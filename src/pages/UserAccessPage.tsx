import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCatalog, getUser, getUserGrants, listRoleTemplates, setUserGrants } from "../api/endpoints";
import { ROLE_LABELS, type GrantSet } from "../api/types";
import { EMPTY_GRANTS, GrantsEditor } from "../components/GrantsEditor";
import { Badge, Button, ErrorBanner, Loading, PageHeader } from "../components/ui";
import { useToast } from "../components/Toast";
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
  const effective = [...(grants.data?.effectivePermissionKeys ?? [])].sort();

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
              allowAdminScope={user.data?.role === "ADMIN"}
            />
          </div>
          <aside className="card h-fit p-5 xl:sticky xl:top-8">
            <h3 className="text-sm font-semibold text-slate-800">Effective permissions (saved)</h3>
            <p className="mt-1 text-xs text-slate-500">
              What the server computes from the saved grants, including always-on shared permissions.
              {grants.data?.updatedAt ? ` Last changed ${formatDateTime(grants.data.updatedAt)}.` : ""}
            </p>
            {dirty && (
              <p className="mt-3">
                <Badge tone="amber">Unsaved changes are not reflected here yet</Badge>
              </p>
            )}
            <p className="mt-3 text-2xl font-semibold">{effective.length}</p>
            <ul className="mt-2 max-h-96 space-y-0.5 overflow-y-auto text-xs">
              {effective.map((key) => (
                <li key={key}>
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
