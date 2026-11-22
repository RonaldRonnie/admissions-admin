import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createAcademicYear,
  createSemester,
  deleteAcademicYear,
  deleteSemester,
  listAcademicYears,
  listSemesters,
  setCurrentAcademicYear,
  setCurrentSemester,
  updateAcademicYear,
} from "../../api/endpoints";
import type { AcademicYear, Semester } from "../../api/types";
import { FormModal, str, text, type FieldSpec, type FormValues } from "../../components/FormModal";
import { Badge, Button, ConfirmDialog, EmptyState, ErrorBanner, Loading, PageHeader } from "../../components/ui";
import { formatDate } from "../../lib/format";
import { deleteOrExplain, useAction } from "../../lib/useAction";

const STATUSES = ["Upcoming", "Active", "Completed"].map((s) => ({ value: s, label: s }));

const endAfterStart = (end: string, values: FormValues) =>
  values.startDate && end <= String(values.startDate) ? "Must be after the start date." : undefined;

const YEAR_FIELDS: FieldSpec[] = [
  {
    name: "name",
    label: "Name",
    required: true,
    placeholder: "2026-2027",
    validate: (v) => {
      const m = /^(\d{4})-(\d{4})$/.exec(v);
      if (!m) return "Format YYYY-YYYY, e.g. 2026-2027.";
      return Number(m[2]) === Number(m[1]) + 1 ? undefined : "The second year follows the first, e.g. 2026-2027.";
    },
  },
  { name: "status", label: "Status", type: "select", options: STATUSES },
  { name: "startDate", label: "Starts", type: "date", required: true },
  { name: "endDate", label: "Ends", type: "date", required: true, validate: endAfterStart },
  { name: "description", label: "Description", type: "textarea" },
];

const SEMESTER_FIELDS: FieldSpec[] = [
  { name: "name", label: "Name", required: true, placeholder: "Semester 1", hint: "Used as the term name in registration, fees and marks." },
  { name: "status", label: "Status", type: "select", options: STATUSES },
  { name: "startDate", label: "Starts", type: "date", required: true },
  { name: "endDate", label: "Ends", type: "date", required: true, validate: endAfterStart },
];

type Pending = { kind: "year"; year: AcademicYear } | { kind: "semester"; semester: Semester };

function Semesters({ year, onDelete }: { year: AcademicYear; onDelete: (s: Semester) => void }) {
  const semesters = useQuery({ queryKey: ["semesters", year.id], queryFn: () => listSemesters(year.id) });
  const [adding, setAdding] = useState(false);
  const create = useAction((v: FormValues) => createSemester(year.id, { name: text(v.name), status: text(v.status), startDate: text(v.startDate), endDate: text(v.endDate) }), {
    invalidate: [["semesters", year.id]],
    success: (v) => `${String(v.name)} added to ${year.name}.`,
    onDone: () => setAdding(false),
  });
  const makeCurrent = useAction((s: Semester) => setCurrentSemester(s.id), {
    invalidate: [["semesters"]],
    success: (s) => `${s.name} of ${year.name} is now the current semester.`,
  });

  const rows = [...(semesters.data ?? [])].sort((a, b) => a.startDate.localeCompare(b.startDate));
  return (
    <div className="bg-slate-50 px-4 py-3">
      {semesters.isLoading ? (
        <Loading label="Loading semesters…" />
      ) : semesters.error ? (
        <ErrorBanner error={semesters.error} onRetry={() => semesters.refetch()} />
      ) : (
        <ul className="space-y-2">
          {rows.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{s.name}</span>
                <span className="text-slate-500">
                  {formatDate(s.startDate)} – {formatDate(s.endDate)}
                </span>
                {s.current && <Badge tone="green">Current</Badge>}
                {s.status && !s.current && <Badge>{s.status}</Badge>}
              </span>
              <span className="flex gap-1.5">
                {!s.current && (
                  <Button size="sm" busy={makeCurrent.isPending && makeCurrent.variables?.id === s.id} onClick={() => makeCurrent.mutate(s)}>
                    Make current
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => onDelete(s)}>
                  Delete
                </Button>
              </span>
            </li>
          ))}
          {rows.length === 0 && <li className="text-sm text-slate-500">No semesters yet.</li>}
        </ul>
      )}
      <Button size="sm" className="mt-3" onClick={() => setAdding(true)}>
        Add semester
      </Button>
      {adding && (
        <FormModal
          title={`New semester in ${year.name}`}
          fields={SEMESTER_FIELDS}
          initial={{ name: "", status: "Upcoming", startDate: "", endDate: "" }}
          submitLabel="Add semester"
          busy={create.isPending}
          onClose={() => setAdding(false)}
          onSubmit={(v) => create.mutate(v)}
        />
      )}
    </div>
  );
}

export function AcademicCalendarPage() {
  const years = useQuery({ queryKey: ["academic-years"], queryFn: listAcademicYears });
  const [editing, setEditing] = useState<AcademicYear | null | undefined>(undefined);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Pending | null>(null);

  const save = useAction(
    ({ year, v }: { year: AcademicYear | null; v: FormValues }) => {
      const body: Partial<AcademicYear> = {
        name: text(v.name),
        status: text(v.status),
        startDate: text(v.startDate),
        endDate: text(v.endDate),
        description: text(v.description),
      };
      // AcademicYearService#update replaces the embedded term list with whatever is sent, and an
      // omitted list arrives as an empty one - so send back what's there.
      return year ? updateAcademicYear(year.id, { ...body, semesters: year.semesters ?? [] }) : createAcademicYear(body);
    },
    { invalidate: [["academic-years"]], success: (a, r) => `${a.year ? "Saved" : "Created"} ${r.name}.`, onDone: () => setEditing(undefined) },
  );
  const makeCurrent = useAction((year: AcademicYear) => setCurrentAcademicYear(year.id), {
    invalidate: [["academic-years"]],
    success: (y) => `${y.name} is now the current academic year.`,
  });
  const remove = useAction(
    (p: Pending) =>
      p.kind === "year"
        ? deleteOrExplain(() => deleteAcademicYear(p.year.id), p.year.name)
        : deleteOrExplain(() => deleteSemester(p.semester.id), p.semester.name),
    {
      invalidate: [["academic-years"], ["semesters"]],
      success: (p) => `${p.kind === "year" ? p.year.name : p.semester.name} deleted.`,
      onDone: () => setDeleting(null),
    },
  );

  const rows = [...(years.data ?? [])].sort((a, b) => b.name.localeCompare(a.name));

  return (
    <>
      <PageHeader
        title="Academic calendar"
        description="Academic years and their semesters. The current year and semester are the defaults for registration, fees, marks and exam clearance."
        actions={
          <Button variant="primary" onClick={() => setEditing(null)}>
            New academic year
          </Button>
        }
      />
      <div className="card divide-y divide-slate-200">
        {years.isLoading ? (
          <Loading />
        ) : years.error ? (
          <div className="p-4">
            <ErrorBanner error={years.error} onRetry={() => years.refetch()} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="No academic years yet.">Registration and fees need a current academic year and semester.</EmptyState>
        ) : (
          rows.map((y) => {
            const expanded = open[y.id] ?? y.current ?? false;
            return (
              <div key={y.id}>
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <button
                    className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left"
                    onClick={() => setOpen((o) => ({ ...o, [y.id]: !expanded }))}
                    aria-expanded={expanded}
                  >
                    <span className="w-3 text-slate-400">{expanded ? "▾" : "▸"}</span>
                    <span className="font-medium">{y.name}</span>
                    <span className="text-sm text-slate-500">
                      {formatDate(y.startDate)} – {formatDate(y.endDate)}
                    </span>
                    {y.current && <Badge tone="green">Current</Badge>}
                    {y.status && !y.current && <Badge>{y.status}</Badge>}
                  </button>
                  <span className="flex gap-1.5">
                    {!y.current && (
                      <Button size="sm" busy={makeCurrent.isPending && makeCurrent.variables?.id === y.id} onClick={() => makeCurrent.mutate(y)}>
                        Make current
                      </Button>
                    )}
                    <Button size="sm" onClick={() => setEditing(y)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting({ kind: "year", year: y })}>
                      Delete
                    </Button>
                  </span>
                </div>
                {expanded && <Semesters year={y} onDelete={(semester) => setDeleting({ kind: "semester", semester })} />}
              </div>
            );
          })
        )}
      </div>

      {editing !== undefined && (
        <FormModal
          title={editing ? `Edit ${editing.name}` : "New academic year"}
          fields={YEAR_FIELDS}
          initial={{
            name: str(editing?.name),
            status: editing?.status || "Upcoming",
            startDate: str(editing?.startDate),
            endDate: str(editing?.endDate),
            description: str(editing?.description),
          }}
          submitLabel={editing ? "Save year" : "Create year"}
          busy={save.isPending}
          onClose={() => setEditing(undefined)}
          onSubmit={(v) => save.mutate({ year: editing, v })}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={deleting?.kind === "semester" ? "Delete semester" : "Delete academic year"}
        danger
        confirmLabel="Delete"
        busy={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
        message={
          deleting && (
            <>
              Delete <strong>{deleting.kind === "year" ? deleting.year.name : deleting.semester.name}</strong>? This can't be undone. Registrations,
              fees and marks refer to terms by name, so only delete a term that was created by mistake.
            </>
          )
        }
      />
    </>
  );
}
