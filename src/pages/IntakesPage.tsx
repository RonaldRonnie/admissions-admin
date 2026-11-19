import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createIntake, deleteIntake, listIntakes, updateIntake } from "../api/endpoints";
import type { Intake } from "../api/types";
import { Badge, Button, Checkbox, ConfirmDialog, EmptyState, ErrorBanner, Field, Loading, Modal, PageHeader } from "../components/ui";
import { useToast } from "../components/Toast";
import { formatDate } from "../lib/format";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type IntakeForm = {
  name: string;
  month: string;
  year: string;
  active: boolean;
  startDate: string;
  endDate: string;
  applicationDeadline: string;
};

function IntakeFormModal({ intake, onClose }: { intake: Intake | null; onClose: () => void }) {
  const creating = intake === null;
  const queryClient = useQueryClient();
  const toast = useToast();
  const thisYear = new Date().getFullYear();
  const [form, setForm] = useState<IntakeForm>({
    name: intake?.name ?? `August ${thisYear}`,
    month: intake?.month ?? "August",
    year: String(intake?.year ?? thisYear),
    active: intake?.active ?? true,
    startDate: intake?.startDate ?? "",
    endDate: intake?.endDate ?? "",
    applicationDeadline: intake?.applicationDeadline ?? "",
  });
  const [touched, setTouched] = useState(false);

  const errors: Partial<Record<keyof IntakeForm, string>> = {};
  if (!form.name.trim()) errors.name = "Required.";
  if (!/^\d{4}$/.test(form.year)) errors.year = "A four-digit year.";
  if (form.startDate && form.endDate && form.endDate < form.startDate) errors.endDate = "Ends before it starts.";
  if (form.applicationDeadline && form.startDate && form.applicationDeadline > form.startDate) {
    errors.applicationDeadline = "Applications would close after the intake starts.";
  }

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        month: form.month,
        year: Number(form.year),
        active: form.active,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        applicationDeadline: form.applicationDeadline || null,
      };
      return creating ? createIntake(body) : updateIntake(intake.id, body);
    },
    onSuccess: (saved) => {
      toast.success(`${creating ? "Created" : "Saved"} ${saved.name}.`);
      queryClient.invalidateQueries({ queryKey: ["intakes"] });
      onClose();
    },
    onError: (error) => toast.error(error),
  });

  function set<K extends keyof IntakeForm>(key: K, value: IntakeForm[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Suggest a name from month + year until the admin types their own.
      const suggested = `${f.month} ${f.year}`;
      if ((key === "month" || key === "year") && (!f.name || f.name === suggested)) next.name = `${next.month} ${next.year}`;
      return next;
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length === 0) mutation.mutate();
  }

  const err = (k: keyof IntakeForm) => (touched ? errors[k] : undefined);

  return (
    <Modal
      open
      title={creating ? "New intake" : `Edit ${intake.name}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="intake-form" variant="primary" busy={mutation.isPending}>
            {creating ? "Create intake" : "Save intake"}
          </Button>
        </>
      }
    >
      <form id="intake-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Month">
          {(id) => (
            <select id={id} className="input" value={form.month} onChange={(e) => set("month", e.target.value)}>
              {MONTHS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Year" error={err("year")}>
          {(id) => <input id={id} inputMode="numeric" className="input" value={form.year} onChange={(e) => set("year", e.target.value)} />}
        </Field>
        <div className="sm:col-span-2">
          <Field label="Name" error={err("name")} hint="What applicants see, e.g. “August 2026”.">
            {(id) => <input id={id} className="input" value={form.name} onChange={(e) => set("name", e.target.value)} />}
          </Field>
        </div>
        <Field label="Applications close" error={err("applicationDeadline")}>
          {(id) => <input id={id} type="date" className="input" value={form.applicationDeadline} onChange={(e) => set("applicationDeadline", e.target.value)} />}
        </Field>
        <div />
        <Field label="Starts">
          {(id) => <input id={id} type="date" className="input" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />}
        </Field>
        <Field label="Ends" error={err("endDate")}>
          {(id) => <input id={id} type="date" className="input" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />}
        </Field>
        <div className="sm:col-span-2">
          <Checkbox
            label="Active"
            description="Only active intakes are offered to applicants."
            checked={form.active}
            onChange={(active) => set("active", active)}
          />
        </div>
      </form>
    </Modal>
  );
}

export function IntakesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const intakes = useQuery({ queryKey: ["intakes"], queryFn: listIntakes });
  const [editing, setEditing] = useState<Intake | null | undefined>(undefined);
  const [deactivating, setDeactivating] = useState<Intake | null>(null);

  const deactivate = useMutation({
    mutationFn: (i: Intake) => deleteIntake(i.id),
    onSuccess: (_d, i) => {
      toast.success(`${i.name} deactivated.`);
      queryClient.invalidateQueries({ queryKey: ["intakes"] });
      setDeactivating(null);
    },
    onError: (error) => toast.error(error),
  });

  const order = (i: Intake) => i.year * 12 + MONTHS.indexOf(i.month);
  const rows = [...(intakes.data ?? [])].sort((a, b) => order(b) - order(a));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="Intakes"
        description="The admission rounds applicants apply to. Removing one only deactivates it; edit it and tick Active to bring it back."
        actions={
          <Button variant="primary" onClick={() => setEditing(null)}>
            New intake
          </Button>
        }
      />
      <div className="card">
        {intakes.isLoading ? (
          <Loading />
        ) : intakes.error ? (
          <div className="p-4">
            <ErrorBanner error={intakes.error} onRetry={() => intakes.refetch()} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="No intakes yet.">Applicants can't apply until an active intake exists.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Intake</th>
                  <th className="th">Applications close</th>
                  <th className="th">Runs</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((i) => {
                  const closed = !!i.applicationDeadline && i.applicationDeadline < today;
                  return (
                    <tr key={i.id} className={i.active ? undefined : "text-slate-500"}>
                      <td className="td">
                        <div className="font-medium">{i.name}</div>
                        <div className="text-xs text-slate-500">
                          {i.month} {i.year}
                        </div>
                      </td>
                      <td className="td whitespace-nowrap">
                        {formatDate(i.applicationDeadline)} {i.active && closed && <Badge tone="amber">closed</Badge>}
                      </td>
                      <td className="td whitespace-nowrap">
                        {i.startDate || i.endDate ? `${formatDate(i.startDate)} – ${formatDate(i.endDate)}` : "—"}
                      </td>
                      <td className="td">{i.active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</td>
                      <td className="td">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" onClick={() => setEditing(i)}>
                            Edit
                          </Button>
                          {i.active && (
                            <Button size="sm" variant="ghost" onClick={() => setDeactivating(i)}>
                              Deactivate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing !== undefined && <IntakeFormModal key={editing?.id ?? "new"} intake={editing} onClose={() => setEditing(undefined)} />}
      <ConfirmDialog
        open={deactivating !== null}
        title="Deactivate intake"
        danger
        confirmLabel="Deactivate"
        busy={deactivate.isPending}
        onClose={() => setDeactivating(null)}
        onConfirm={() => deactivating && deactivate.mutate(deactivating)}
        message={
          deactivating && (
            <>
              Deactivate <strong>{deactivating.name}</strong>? It stops being offered to applicants. Existing applications are kept, and you can
              reactivate it later.
            </>
          )
        }
      />
    </>
  );
}
