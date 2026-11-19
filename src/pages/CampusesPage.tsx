import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createCampus, deleteCampus, listCampuses, updateCampus } from "../api/endpoints";
import type { Campus } from "../api/types";
import { Badge, Button, Checkbox, ConfirmDialog, EmptyState, ErrorBanner, Field, Loading, Modal, PageHeader } from "../components/ui";
import { useToast } from "../components/Toast";

type CampusForm = Omit<Campus, "id">;

const EMPTY: CampusForm = {
  code: "",
  name: "",
  location: "",
  description: "",
  address: "",
  phone: "",
  email: "",
  daySchedule: "",
  eveningSchedule: "",
  active: true,
};

const TEXT_FIELDS: { key: keyof CampusForm; label: string; wide?: boolean; hint?: string }[] = [
  { key: "code", label: "Code", hint: "Short identifier, e.g. MAIN or KLA." },
  { key: "name", label: "Name" },
  { key: "location", label: "Location" },
  { key: "address", label: "Address" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "daySchedule", label: "Day schedule", hint: "e.g. Mon–Fri, 8:00–17:00" },
  { key: "eveningSchedule", label: "Evening schedule" },
  { key: "description", label: "Description", wide: true },
];

function CampusFormModal({ campus, onClose }: { campus: Campus | null; onClose: () => void }) {
  const creating = campus === null;
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<CampusForm>(() => {
    if (!campus) return EMPTY;
    const { id: _id, ...rest } = campus;
    return { ...EMPTY, ...rest };
  });
  const [touched, setTouched] = useState(false);
  const errors: Partial<Record<keyof CampusForm, string>> = {};
  if (!form.code?.trim()) errors.code = "Required.";
  if (!form.name?.trim()) errors.name = "Required.";

  const mutation = useMutation({
    mutationFn: () => {
      const body = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, typeof v === "string" ? v.trim() || undefined : v]),
      ) as CampusForm;
      return creating ? createCampus(body) : updateCampus(campus.id, body);
    },
    onSuccess: (saved) => {
      toast.success(`${creating ? "Created" : "Saved"} ${saved.name}.`);
      queryClient.invalidateQueries({ queryKey: ["campuses"] });
      onClose();
    },
    onError: (error) => toast.error(error),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length === 0) mutation.mutate();
  }

  return (
    <Modal
      open
      title={creating ? "New campus" : `Edit ${campus.name}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="campus-form" variant="primary" busy={mutation.isPending}>
            {creating ? "Create campus" : "Save campus"}
          </Button>
        </>
      }
    >
      <form id="campus-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {TEXT_FIELDS.map((f) => (
          <div key={f.key} className={f.wide ? "sm:col-span-2" : undefined}>
            <Field label={f.label} hint={f.hint} error={touched ? errors[f.key] : undefined}>
              {(id) =>
                f.wide ? (
                  <textarea id={id} rows={3} className="input" value={String(form[f.key] ?? "")} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                ) : (
                  <input id={id} className="input" value={String(form[f.key] ?? "")} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                )
              }
            </Field>
          </div>
        ))}
        <div className="sm:col-span-2">
          <Checkbox
            label="Active"
            description="Inactive campuses are hidden from applicants choosing where to study."
            checked={form.active}
            onChange={(active) => setForm({ ...form, active })}
          />
        </div>
      </form>
    </Modal>
  );
}

export function CampusesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const campuses = useQuery({ queryKey: ["campuses"], queryFn: listCampuses });
  const [editing, setEditing] = useState<Campus | null | undefined>(undefined);
  const [deactivating, setDeactivating] = useState<Campus | null>(null);

  const deactivate = useMutation({
    mutationFn: (c: Campus) => deleteCampus(c.id),
    onSuccess: (_d, c) => {
      toast.success(`${c.name} deactivated.`);
      queryClient.invalidateQueries({ queryKey: ["campuses"] });
      setDeactivating(null);
    },
    onError: (error) => toast.error(error),
  });

  const rows = [...(campuses.data ?? [])].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader
        title="Campuses"
        description="The campuses applicants can choose. Removing one only deactivates it; edit it and tick Active to bring it back."
        actions={
          <Button variant="primary" onClick={() => setEditing(null)}>
            New campus
          </Button>
        }
      />
      <div className="card">
        {campuses.isLoading ? (
          <Loading />
        ) : campuses.error ? (
          <div className="p-4">
            <ErrorBanner error={campuses.error} onRetry={() => campuses.refetch()} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="No campuses yet.">Applicants can't choose a campus until at least one exists.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Campus</th>
                  <th className="th">Location</th>
                  <th className="th">Contact</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((c) => (
                  <tr key={c.id} className={c.active ? undefined : "text-slate-500"}>
                    <td className="td">
                      <div className="font-medium">{c.name}</div>
                      <code className="text-xs text-slate-500">{c.code}</code>
                    </td>
                    <td className="td">{c.location || c.address || "—"}</td>
                    <td className="td text-xs">
                      {c.phone && <div>{c.phone}</div>}
                      {c.email && <div>{c.email}</div>}
                      {!c.phone && !c.email && "—"}
                    </td>
                    <td className="td">{c.active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</td>
                    <td className="td">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" onClick={() => setEditing(c)}>
                          Edit
                        </Button>
                        {c.active && (
                          <Button size="sm" variant="ghost" onClick={() => setDeactivating(c)}>
                            Deactivate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing !== undefined && <CampusFormModal key={editing?.id ?? "new"} campus={editing} onClose={() => setEditing(undefined)} />}
      <ConfirmDialog
        open={deactivating !== null}
        title="Deactivate campus"
        danger
        confirmLabel="Deactivate"
        busy={deactivate.isPending}
        onClose={() => setDeactivating(null)}
        onConfirm={() => deactivating && deactivate.mutate(deactivating)}
        message={
          deactivating && (
            <>
              Deactivate <strong>{deactivating.name}</strong>? New applicants won't be able to choose it. Existing records are kept, and you can
              reactivate it later.
            </>
          )
        }
      />
    </>
  );
}
