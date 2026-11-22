import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  assignLecturer,
  createCourseUnit,
  deleteCourseUnit,
  listAssignableLecturers,
  listCourses,
  listCourseUnits,
  setOptionalOffering,
  updateCourseUnit,
} from "../../api/endpoints";
import type { CourseUnit } from "../../api/types";
import { FormModal, isWholeNumber, num, STATUS_OPTIONS, str, text, type FieldSpec, type FormValues } from "../../components/FormModal";
import { TableCard } from "../../components/TableCard";
import { Badge, Button, Checkbox, ConfirmDialog, ErrorBanner, Field, Loading, Modal, PageHeader } from "../../components/ui";
import { fullName } from "../../lib/format";
import { deleteOrExplain, useAction } from "../../lib/useAction";

function LecturerModal({ unit, onClose }: { unit: CourseUnit; onClose: () => void }) {
  const lecturers = useQuery({ queryKey: ["assignable-lecturers"], queryFn: listAssignableLecturers });
  const [lecturerId, setLecturerId] = useState(unit.assignedLecturer?.id ?? "");
  const assign = useAction((id: string) => assignLecturer(unit.id, id), {
    invalidate: [["course-units"]],
    success: () => `Lecturer assigned to ${unit.code}.`,
    onDone: onClose,
  });
  return (
    <Modal
      open
      title={`Lecturer for ${unit.code}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={assign.isPending} disabled={!lecturerId || lecturerId === unit.assignedLecturer?.id} onClick={() => assign.mutate(lecturerId)}>
            Assign
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600">
        The assigned lecturer sees {unit.name} under My Courses and enters its marks until the department finalises them.
      </p>
      {lecturers.isLoading ? (
        <Loading />
      ) : lecturers.error ? (
        <ErrorBanner error={lecturers.error} onRetry={() => lecturers.refetch()} />
      ) : (
        <Field label="Lecturer">
          {(id) => (
            <select id={id} className="input" value={lecturerId} onChange={(e) => setLecturerId(e.target.value)}>
              <option value="">Choose…</option>
              {(lecturers.data ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {fullName(l)} · {l.email}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
    </Modal>
  );
}

function OptionalOfferingModal({ courseId, courseName, units, onClose }: { courseId: string; courseName: string; units: CourseUnit[]; onClose: () => void }) {
  const [optional, setOptional] = useState(() => new Set(units.filter((u) => u.optional).map((u) => u.id)));
  const save = useAction(() => setOptionalOffering(courseId, [...optional]), {
    invalidate: [["course-units"]],
    success: () => `Optional units of ${courseName} saved.`,
    onDone: onClose,
  });
  return (
    <Modal
      open
      wide
      title={`Optional units: ${courseName}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={save.isPending} onClick={() => save.mutate(undefined)}>
            Save offering
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-slate-600">Ticked units are electives students may choose; the rest are core and required.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {units.map((u) => (
          <Checkbox
            key={u.id}
            checked={optional.has(u.id)}
            onChange={(on) =>
              setOptional((s) => {
                const next = new Set(s);
                if (on) next.add(u.id);
                else next.delete(u.id);
                return next;
              })
            }
            label={`${u.code} · ${u.name}`}
            description={[u.year && `Year ${u.year}`, u.semester, u.credits && `${u.credits} CU`].filter(Boolean).join(" · ")}
          />
        ))}
      </div>
    </Modal>
  );
}

export function CourseUnitsPage() {
  const units = useQuery({ queryKey: ["course-units"], queryFn: listCourseUnits });
  const courses = useQuery({ queryKey: ["courses"], queryFn: listCourses });
  const [courseFilter, setCourseFilter] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<CourseUnit | null | undefined>(undefined);
  const [lecturerFor, setLecturerFor] = useState<CourseUnit | null>(null);
  const [deleting, setDeleting] = useState<CourseUnit | null>(null);
  const [offeringOpen, setOfferingOpen] = useState(false);

  const save = useAction(
    ({ unit, values }: { unit: CourseUnit | null; values: FormValues }) => {
      const body: Partial<CourseUnit> = {
        code: text(values.code),
        name: text(values.name),
        credits: num(values.credits),
        year: num(values.year),
        semester: text(values.semester),
        status: text(values.status),
        description: text(values.description),
        optional: Boolean(values.optional),
      };
      if (unit) return updateCourseUnit(unit.id, body);
      // CourseUnitService#create only files the unit under a school and department when told to;
      // the Department module scopes by them, so pass the course's own.
      const course = courses.data?.find((c) => c.id === values.courseId);
      return createCourseUnit(body, String(values.courseId), course?.school?.id, course?.department?.id);
    },
    { invalidate: [["course-units"]], success: (a) => `${a.unit ? "Saved" : "Created"} ${String(a.values.code)}.`, onDone: () => setEditing(undefined) },
  );
  const remove = useAction((unit: CourseUnit) => deleteOrExplain(() => deleteCourseUnit(unit.id), unit.code), {
    invalidate: [["course-units"]],
    success: (u) => `${u.code} deleted.`,
    onDone: () => setDeleting(null),
  });

  const courseOptions = [...(courses.data ?? [])]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ value: c.id, label: `${c.courseCode} · ${c.name}` }));
  const creating = editing === null;
  const fields: FieldSpec[] = [
    { name: "courseId", label: "Course", type: "select", options: courseOptions, required: creating, disabled: !creating, wide: true, hint: creating ? undefined : "A unit stays with the course it was created under." },
    { name: "code", label: "Code", required: true, disabled: !creating, placeholder: "CSC 1101" },
    { name: "name", label: "Name", required: true },
    { name: "credits", label: "Credit units", type: "number", required: true, validate: isWholeNumber(1, 30) },
    { name: "year", label: "Year of study", type: "number", validate: isWholeNumber(1, 8) },
    { name: "semester", label: "Semester", placeholder: "Semester 1" },
    { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
    { name: "description", label: "Description", type: "textarea" },
    { name: "optional", label: "Optional (elective)", type: "checkbox", description: "Students choose electives; core units are required." },
  ];

  const needle = search.trim().toLowerCase();
  const rows = (units.data ?? [])
    .filter((u) => !courseFilter || u.course?.id === courseFilter)
    .filter((u) => !needle || u.name.toLowerCase().includes(needle) || u.code.toLowerCase().includes(needle))
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0) || (a.semester ?? "").localeCompare(b.semester ?? "") || a.code.localeCompare(b.code));
  const filterCourse = courses.data?.find((c) => c.id === courseFilter);

  return (
    <>
      <PageHeader
        title="Course units"
        description="The subjects of each course: credits drive the semester fee, the assigned lecturer enters marks, and electives are marked optional."
        actions={
          <>
            {filterCourse && (
              <Button onClick={() => setOfferingOpen(true)} disabled={rows.length === 0}>
                Optional offering
              </Button>
            )}
            <Button variant="primary" onClick={() => setEditing(null)} disabled={!courses.data?.length}>
              New course unit
            </Button>
          </>
        }
      />
      <TableCard
        rows={rows}
        rowKey={(u) => u.id}
        loading={units.isLoading}
        error={units.error}
        onRetry={() => units.refetch()}
        empty={courses.data?.length === 0 ? "Create a course first; every unit belongs to one." : "No course units match."}
        toolbar={
          <>
            <input className="input max-w-xs" placeholder="Search code or name…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="input w-auto max-w-md" aria-label="Course" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
              <option value="">All courses</option>
              {courseOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500">Pick a course to set its optional units.</span>
          </>
        }
        columns={[
          {
            header: "Unit",
            cell: (u) => (
              <>
                <div className="font-medium">{u.name}</div>
                <code className="text-xs text-slate-500">{u.code}</code>
              </>
            ),
          },
          { header: "Course", cell: (u) => u.course?.courseCode ?? u.course?.name ?? "—" },
          { header: "Year / semester", cell: (u) => [u.year && `Year ${u.year}`, u.semester].filter(Boolean).join(" · ") || "—" },
          { header: "Credits", cell: (u) => u.credits ?? "—" },
          {
            header: "Lecturer",
            cell: (u) => (u.assignedLecturer ? fullName(u.assignedLecturer) : <span className="text-slate-400">Unassigned</span>),
          },
          {
            header: "Type",
            cell: (u) => (
              <span className="flex flex-wrap gap-1">
                {u.optional ? <Badge tone="blue">Elective</Badge> : <Badge>Core</Badge>}
                {u.status === "Inactive" && <Badge tone="amber">Inactive</Badge>}
              </span>
            ),
          },
          {
            header: "Actions",
            className: "text-right",
            cell: (u) => (
              <div className="flex justify-end gap-1.5">
                <Button size="sm" onClick={() => setEditing(u)}>
                  Edit
                </Button>
                <Button size="sm" onClick={() => setLecturerFor(u)}>
                  Lecturer
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleting(u)}>
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
      />

      {editing !== undefined && (
        <FormModal
          title={editing ? `Edit ${editing.code}` : "New course unit"}
          fields={fields}
          initial={{
            courseId: editing?.course?.id ?? courseFilter,
            code: str(editing?.code),
            name: str(editing?.name),
            credits: str(editing?.credits),
            year: str(editing?.year),
            semester: str(editing?.semester),
            status: editing?.status || "Active",
            description: str(editing?.description),
            optional: Boolean(editing?.optional),
          }}
          submitLabel={editing ? "Save unit" : "Create unit"}
          busy={save.isPending}
          onClose={() => setEditing(undefined)}
          onSubmit={(values) => save.mutate({ unit: editing, values })}
        />
      )}
      {lecturerFor && <LecturerModal unit={lecturerFor} onClose={() => setLecturerFor(null)} />}
      {offeringOpen && filterCourse && (
        <OptionalOfferingModal courseId={filterCourse.id} courseName={filterCourse.name} units={(units.data ?? []).filter((u) => u.course?.id === filterCourse.id)} onClose={() => setOfferingOpen(false)} />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete course unit"
        danger
        confirmLabel="Delete"
        busy={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
        message={
          deleting && (
            <>
              Delete <strong>{deleting.code}</strong> ({deleting.name})? This can't be undone. The server refuses while enrolments or grades point at
              it; set it Inactive instead.
            </>
          )
        }
      />
    </>
  );
}
