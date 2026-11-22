import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createCourse, deleteCourse, listCourses, listCourseUnits, listDepartments, listSchools, updateCourse } from "../../api/endpoints";
import type { Course } from "../../api/types";
import { FormModal, isWholeNumber, num, STATUS_OPTIONS, str, text, type FieldSpec, type FormValues } from "../../components/FormModal";
import { TableCard } from "../../components/TableCard";
import { Badge, Button, ConfirmDialog, PageHeader } from "../../components/ui";
import { deleteOrExplain, useAction } from "../../lib/useAction";

const LEVELS = ["Certificate", "Diploma", "Bachelor", "Masters", "PhD"].map((v) => ({ value: v, label: v }));
const MODES = ["Full-time", "Part-time", "Evening", "Weekend", "Online"].map((v) => ({ value: v, label: v }));

export function CoursesPage() {
  const courses = useQuery({ queryKey: ["courses"], queryFn: listCourses });
  const schools = useQuery({ queryKey: ["schools"], queryFn: listSchools });
  const departments = useQuery({ queryKey: ["departments"], queryFn: listDepartments });
  const units = useQuery({ queryKey: ["course-units"], queryFn: listCourseUnits });
  const [schoolFilter, setSchoolFilter] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Course | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Course | null>(null);
  const [chosenSchool, setChosenSchool] = useState("");

  const save = useAction(
    ({ course, values }: { course: Course | null; values: FormValues }) => {
      const body: Partial<Course> = {
        name: text(values.name),
        type: text(values.type),
        mode: text(values.mode),
        creditsRequired: num(values.creditsRequired),
        status: text(values.status),
        description: text(values.description),
      };
      if (course) return updateCourse(course.id, body);
      const years = num(values.numberOfYears);
      return createCourse(
        { ...body, courseCode: text(values.courseCode), numberOfYears: years, durationMonths: years !== undefined ? years * 12 : undefined },
        text(values.schoolId),
        text(values.departmentId),
      );
    },
    { invalidate: [["courses"]], success: (a, r) => `${a.course ? "Saved" : "Created"} ${r.name}.`, onDone: () => setEditing(undefined) },
  );
  const remove = useAction((course: Course) => deleteOrExplain(() => deleteCourse(course.id), course.name), {
    invalidate: [["courses"]],
    success: (c) => `${c.name} deleted.`,
    onDone: () => setDeleting(null),
  });

  const schoolOptions = (schools.data ?? []).map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }));
  const deptOptions = (departments.data ?? [])
    .filter((d) => !chosenSchool || d.school?.id === chosenSchool)
    .map((d) => ({ value: d.id, label: `${d.name} (${d.code})` }));
  const creating = editing === null;
  const fields: FieldSpec[] = [
    { name: "courseCode", label: "Code", required: creating, disabled: !creating, hint: creating ? "e.g. BSCS" : "The code can't change once created." },
    { name: "name", label: "Name", required: true, placeholder: "Bachelor of Science in Computer Science" },
    { name: "schoolId", label: "School", type: "select", options: schoolOptions, required: creating, disabled: !creating },
    { name: "departmentId", label: "Department", type: "select", options: deptOptions, disabled: !creating, hint: creating ? undefined : "School and department are fixed after creation." },
    { name: "type", label: "Level", type: "select", options: LEVELS },
    { name: "mode", label: "Mode", type: "select", options: MODES },
    // CourseService#update doesn't copy numberOfYears, which bounds the units' year of study.
    { name: "numberOfYears", label: "Years of study", type: "number", validate: isWholeNumber(1, 8), disabled: !creating },
    { name: "creditsRequired", label: "Credits to graduate", type: "number", validate: isWholeNumber(0) },
    { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
    { name: "description", label: "Description", type: "textarea" },
  ];

  const unitCount = (id: string) => (units.data ?? []).filter((u) => u.course?.id === id).length;
  const needle = search.trim().toLowerCase();
  const rows = (courses.data ?? [])
    .filter((c) => !schoolFilter || c.school?.id === schoolFilter)
    .filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.courseCode.toLowerCase().includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name));

  function open(course: Course | null) {
    setChosenSchool(course?.school?.id ?? schoolFilter);
    setEditing(course);
  }

  return (
    <>
      <PageHeader
        title="Courses"
        description="Programmes students apply to and register on. Their course units, and fees per credit hour, hang off these."
        actions={
          <Button variant="primary" onClick={() => open(null)} disabled={!schools.data?.length}>
            New course
          </Button>
        }
      />
      <TableCard
        rows={rows}
        rowKey={(c) => c.id}
        loading={courses.isLoading}
        error={courses.error}
        onRetry={() => courses.refetch()}
        empty={schools.data?.length === 0 ? "Create a school first; every course belongs to one." : "No courses match."}
        toolbar={
          <>
            <input className="input max-w-xs" placeholder="Search name or code…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="input w-auto" aria-label="School" value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)}>
              <option value="">All schools</option>
              {schoolOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </>
        }
        columns={[
          {
            header: "Course",
            cell: (c) => (
              <>
                <div className="font-medium">{c.name}</div>
                <code className="text-xs text-slate-500">{c.courseCode}</code>
              </>
            ),
          },
          {
            header: "School / department",
            cell: (c) => (
              <>
                <div>{c.school?.name ?? "—"}</div>
                <div className="text-xs text-slate-500">{c.department?.name}</div>
              </>
            ),
          },
          { header: "Level", cell: (c) => [c.type, c.mode].filter(Boolean).join(" · ") || "—" },
          { header: "Years", cell: (c) => c.numberOfYears ?? "—" },
          { header: "Units", cell: (c) => unitCount(c.id) },
          { header: "Status", cell: (c) => <Badge tone={c.status === "Inactive" ? "gray" : "green"}>{c.status || "Active"}</Badge> },
          {
            header: "Actions",
            className: "text-right",
            cell: (c) => (
              <div className="flex justify-end gap-1.5">
                <Button size="sm" onClick={() => open(c)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleting(c)}>
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
      />

      {editing !== undefined && (
        <FormModal
          title={editing ? `Edit ${editing.name}` : "New course"}
          fields={fields}
          initial={{
            courseCode: str(editing?.courseCode),
            name: str(editing?.name),
            schoolId: editing?.school?.id ?? chosenSchool,
            departmentId: str(editing?.department?.id),
            type: str(editing?.type),
            mode: str(editing?.mode),
            numberOfYears: str(editing?.numberOfYears),
            creditsRequired: str(editing?.creditsRequired),
            status: editing?.status || "Active",
            description: str(editing?.description),
          }}
          onChange={(name, values) => {
            if (name !== "schoolId") return values;
            setChosenSchool(String(values.schoolId));
            return { ...values, departmentId: "" };
          }}
          submitLabel={editing ? "Save course" : "Create course"}
          busy={save.isPending}
          onClose={() => setEditing(undefined)}
          onSubmit={(values) => save.mutate({ course: editing, values })}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete course"
        danger
        confirmLabel="Delete"
        busy={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
        message={
          deleting && (
            <>
              Delete <strong>{deleting.name}</strong>? This can't be undone. The server refuses while course units, students or applications still
              point at it; set it Inactive instead to keep its history.
            </>
          )
        }
      />
    </>
  );
}
