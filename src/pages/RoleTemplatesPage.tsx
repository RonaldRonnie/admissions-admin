import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createRoleTemplate, deleteRoleTemplate, getCatalog, listRoleTemplates, updateRoleTemplate } from "../api/endpoints";
import type { CatalogModule, RoleTemplate } from "../api/types";
import { PermissionPicker } from "../components/PermissionPicker";
import { Button, ConfirmDialog, EmptyState, ErrorBanner, Field, Loading, Modal, PageHeader } from "../components/ui";
import { useToast } from "../components/Toast";
import { formatDateTime } from "../lib/format";

const KEY_RULE = /^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/;

function TemplateForm({
  template,
  templates,
  catalog,
  onClose,
}: {
  template: RoleTemplate | null;
  templates: RoleTemplate[];
  catalog: CatalogModule[];
  onClose: () => void;
}) {
  const creating = template === null;
  const queryClient = useQueryClient();
  const toast = useToast();
  const [key, setKey] = useState(template?.key ?? "");
  const [displayName, setDisplayName] = useState(template?.displayName ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [parentKey, setParentKey] = useState(template?.parentKey ?? "");
  const [permissionKeys, setPermissionKeys] = useState<string[]>(template?.permissionKeys ?? []);
  const [touched, setTouched] = useState(false);

  const keyError = creating && !KEY_RULE.test(key) ? "Lowercase letters and digits, separated by - _ or ." : undefined;
  const nameError = displayName.trim() ? undefined : "Required.";

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        key,
        displayName: displayName.trim(),
        description: description.trim() || undefined,
        parentKey: parentKey || null,
        permissionKeys,
      };
      return creating ? createRoleTemplate(body) : updateRoleTemplate(template.id, body);
    },
    onSuccess: (saved) => {
      toast.success(`${creating ? "Created" : "Saved"} “${saved.displayName}”.`);
      queryClient.invalidateQueries({ queryKey: ["role-templates"] });
      queryClient.invalidateQueries({ queryKey: ["grants"] });
      onClose();
    },
    onError: (error) => toast.error(error),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!keyError && !nameError) mutation.mutate();
  }

  return (
    <Modal
      wide
      open
      title={creating ? "New role template" : `Edit “${template.displayName}”`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="template-form" variant="primary" busy={mutation.isPending}>
            {creating ? "Create template" : "Save template"}
          </Button>
        </>
      }
    >
      <form id="template-form" onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Key"
            error={touched ? keyError : undefined}
            hint={creating ? "Permanent identifier, e.g. registrar-clerk. Cannot be changed later." : "Keys cannot be changed."}
          >
            {(id) => (
              <input id={id} className="input font-mono" value={key} disabled={!creating} onChange={(e) => setKey(e.target.value.toLowerCase())} />
            )}
          </Field>
          <Field label="Display name" error={touched ? nameError : undefined}>
            {(id) => <input id={id} className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />}
          </Field>
          <Field label="Description (optional)">
            {(id) => <input id={id} className="input" value={description} onChange={(e) => setDescription(e.target.value)} />}
          </Field>
          <Field label="Inherits from (optional)" hint="Holders also get every permission of the parent, and its parent, and so on.">
            {(id) => (
              <select id={id} className="input" value={parentKey} onChange={(e) => setParentKey(e.target.value)}>
                <option value="">No parent</option>
                {templates
                  .filter((t) => t.key !== key)
                  .map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.displayName}
                    </option>
                  ))}
              </select>
            )}
          </Field>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Permissions</p>
          <PermissionPicker catalog={catalog} value={permissionKeys} onChange={setPermissionKeys} />
        </div>
      </form>
    </Modal>
  );
}

export function RoleTemplatesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const templates = useQuery({ queryKey: ["role-templates"], queryFn: listRoleTemplates });
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: () => getCatalog() });
  const [editing, setEditing] = useState<RoleTemplate | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<RoleTemplate | null>(null);

  const remove = useMutation({
    mutationFn: (t: RoleTemplate) => deleteRoleTemplate(t.id),
    onSuccess: (_d, t) => {
      toast.success(`Deleted “${t.displayName}”.`);
      queryClient.invalidateQueries({ queryKey: ["role-templates"] });
      queryClient.invalidateQueries({ queryKey: ["grants"] });
      setDeleting(null);
    },
    onError: (error) => toast.error(error),
  });

  const all = templates.data ?? [];
  const nameOf = (key?: string | null) => all.find((t) => t.key === key)?.displayName ?? key;

  return (
    <>
      <PageHeader
        title="Role templates"
        description="Named bundles of permissions you can hand to many people at once, e.g. “Registrar clerk”. Changing a template changes the access of everyone who holds it."
        actions={
          <Button variant="primary" disabled={!catalog.data} onClick={() => setEditing(null)}>
            New template
          </Button>
        }
      />
      <div className="card">
        {templates.isLoading ? (
          <Loading />
        ) : templates.error ? (
          <div className="p-4">
            <ErrorBanner error={templates.error} onRetry={() => templates.refetch()} />
          </div>
        ) : all.length === 0 ? (
          <EmptyState title="No role templates yet.">Create one to grant the same access to several people quickly.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Template</th>
                  <th className="th">Inherits from</th>
                  <th className="th">Permissions</th>
                  <th className="th">Updated</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {all.map((t) => (
                  <tr key={t.id}>
                    <td className="td">
                      <div className="font-medium">{t.displayName}</div>
                      <div className="text-xs text-slate-500">
                        <code>{t.key}</code>
                        {t.description ? ` · ${t.description}` : ""}
                      </div>
                    </td>
                    <td className="td text-slate-600">{t.parentKey ? nameOf(t.parentKey) : "—"}</td>
                    <td className="td">{t.permissionKeys.length}</td>
                    <td className="td whitespace-nowrap text-slate-600">{formatDateTime(t.updatedAt)}</td>
                    <td className="td">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" disabled={!catalog.data} onClick={() => setEditing(t)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleting(t)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing !== undefined && catalog.data && (
        <TemplateForm key={editing?.id ?? "new"} template={editing} templates={all} catalog={catalog.data} onClose={() => setEditing(undefined)} />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete role template"
        danger
        confirmLabel="Delete"
        busy={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
        message={
          deleting && (
            <>
              Delete <strong>{deleting.displayName}</strong>? Everyone who holds it loses its permissions straight away, and any template
              that inherits from it stops inheriting them. This cannot be undone.
            </>
          )
        }
      />
    </>
  );
}
