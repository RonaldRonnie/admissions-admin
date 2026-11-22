import { request, requestData, requestText } from "./client";
import type {
  AdminHealth,
  AuditLog,
  AcademicYear,
  AuthenticationResponse,
  BulkGrantRequest,
  Campus,
  CatalogModule,
  Classroom,
  Course,
  CourseUnit,
  CreateUserRequest,
  DatabaseHealth,
  Department,
  Examination,
  GrantSet,
  Intake,
  LeaderCandidate,
  LookupCategory,
  LookupValue,
  PaginatedResponse,
  PermissionGroup,
  ReportDefinition,
  RoleTemplate,
  RoleTemplateRequest,
  School,
  Semester,
  UpdateUserRequest,
  User,
  UserAccessGrant,
  UserRole,
} from "./types";

// ---- Auth (AuthController, /api/auth) ----

export const login = (email: string, password: string) =>
  request<AuthenticationResponse>("/auth/login", { method: "POST", body: { email, password }, auth: false });

/** Answers 200 only to an admin (AdminController is @PreAuthorize("hasRole('ADMIN')")). */
export const adminHealth = () => request<AdminHealth>("/admin/health");

export const changePassword = (currentPassword: string, newPassword: string) =>
  requestData<void>("/auth/change-password", { method: "POST", body: { currentPassword, newPassword } });

// ---- Users (AdminController, /api/admin/users) ----

export const listUsers = () => requestData<User[]>("/admin/users");
export const listPendingUsers = () => requestData<User[]>("/admin/users/pending");
export const getUser = (id: string) => requestData<User>(`/admin/users/${id}`);
export const createUser = (body: CreateUserRequest) =>
  requestData<User>("/admin/users", { method: "POST", body });
export const updateUser = (id: string, body: UpdateUserRequest) =>
  requestData<User>(`/admin/users/${id}`, { method: "PUT", body });
/** Soft delete: the account is disabled, not removed (UserService#deleteUser). */
export const deleteUser = (id: string) => requestData<void>(`/admin/users/${id}`, { method: "DELETE" });
export const approveUser = (id: string, role?: UserRole) =>
  requestData<User>(`/admin/users/${id}/approve`, { method: "POST", body: role ? { role } : {} });
export const rejectUser = (id: string, reason?: string) =>
  requestData<User>(`/admin/users/${id}/reject`, { method: "POST", body: { reason } });
export const suspendUser = (id: string, reason?: string) =>
  requestData<User>(`/admin/users/${id}/suspend`, { method: "POST", body: { reason } });
export const reactivateUser = (id: string) =>
  requestData<User>(`/admin/users/${id}/reactivate`, { method: "POST" });

// ---- Access control (AccessControlController, /api/admin/access-control) ----

const AC = "/admin/access-control";

export const getCatalog = (filters: { q?: string; group?: PermissionGroup; sensitive?: boolean } = {}) =>
  requestData<CatalogModule[]>(`${AC}/catalog`, { query: filters });
export const getUserGrants = (userId: string) => requestData<UserAccessGrant>(`${AC}/users/${userId}/grants`);
export const setUserGrants = (userId: string, grants: GrantSet) =>
  requestData<UserAccessGrant>(`${AC}/users/${userId}/grants`, { method: "PUT", body: grants });
export const bulkSetGrants = (body: BulkGrantRequest) =>
  requestData<UserAccessGrant[]>(`${AC}/users/bulk-grants`, { method: "POST", body });
export const listRoleTemplates = () => requestData<RoleTemplate[]>(`${AC}/role-templates`);
export const createRoleTemplate = (body: RoleTemplateRequest) =>
  requestData<RoleTemplate>(`${AC}/role-templates`, { method: "POST", body });
export const updateRoleTemplate = (id: string, body: RoleTemplateRequest) =>
  requestData<RoleTemplate>(`${AC}/role-templates/${id}`, { method: "PUT", body });
export const deleteRoleTemplate = (id: string) =>
  requestData<void>(`${AC}/role-templates/${id}`, { method: "DELETE" });

// ---- Campuses & intakes (AdminController) ----

export const listCampuses = () => requestData<Campus[]>("/admin/campuses");
export const createCampus = (body: Omit<Campus, "id">) =>
  requestData<Campus>("/admin/campuses", { method: "POST", body });
export const updateCampus = (id: string, body: Omit<Campus, "id">) =>
  requestData<Campus>(`/admin/campuses/${id}`, { method: "PUT", body });
export const deleteCampus = (id: string) => requestData<void>(`/admin/campuses/${id}`, { method: "DELETE" });

export const listIntakes = () => requestData<Intake[]>("/admin/intakes");
export const createIntake = (body: Omit<Intake, "id">) =>
  requestData<Intake>("/admin/intakes", { method: "POST", body });
export const updateIntake = (id: string, body: Omit<Intake, "id">) =>
  requestData<Intake>(`/admin/intakes/${id}`, { method: "PUT", body });
export const deleteIntake = (id: string) => requestData<void>(`/admin/intakes/${id}`, { method: "DELETE" });

// ---- Audit log (AuditLogController, /api/audit-logs) ----

export const listAuditLogs = (page: number, limit: number, action?: string) =>
  request<PaginatedResponse<AuditLog[]>>("/audit-logs", { query: { page, limit, action } });

// ---- Organisation ----

export const listSchools = () => requestData<School[]>("/schools/all");
export const createSchool = (body: Partial<School>) => requestData<School>("/schools", { method: "POST", body });
export const updateSchool = (id: string, body: Partial<School>) =>
  requestData<School>(`/schools/${id}`, { method: "PUT", body });
export const deleteSchool = (id: string) => requestData<void>(`/schools/${id}`, { method: "DELETE" });
/** No userId clears the dean. */
export const setSchoolDean = (id: string, userId?: string) =>
  requestData<School>(`/schools/${id}/dean`, { method: "PUT", query: { userId } });

export const listDepartments = () => requestData<Department[]>("/departments/all");
export const createDepartment = (schoolId: string, body: Partial<Department>) =>
  requestData<Department>("/departments", { method: "POST", body, query: { schoolId } });
export const updateDepartment = (id: string, schoolId: string, body: Partial<Department>) =>
  requestData<Department>(`/departments/${id}`, { method: "PUT", body, query: { schoolId } });
export const deleteDepartment = (id: string) => requestData<void>(`/departments/${id}`, { method: "DELETE" });
export const setDepartmentHead = (id: string, userId?: string) =>
  requestData<Department>(`/departments/${id}/head`, { method: "PUT", query: { userId } });
export const listLeaderCandidates = () => requestData<LeaderCandidate[]>("/departments/leader-candidates");

export const listCourses = () => requestData<Course[]>("/courses/all");
export const createCourse = (body: Partial<Course>, schoolId?: string, departmentId?: string) =>
  requestData<Course>("/courses", { method: "POST", body, query: { schoolId, departmentId } });
/** CourseService#update leaves the code, school and department as they are. */
export const updateCourse = (id: string, body: Partial<Course>) =>
  requestData<Course>(`/courses/${id}`, { method: "PUT", body });
export const deleteCourse = (id: string) => requestData<void>(`/courses/${id}`, { method: "DELETE" });

export const listCourseUnits = () => requestData<CourseUnit[]>("/course-units/all");
export const createCourseUnit = (body: Partial<CourseUnit>, courseId: string, schoolId?: string, departmentId?: string) =>
  requestData<CourseUnit>("/course-units", { method: "POST", body, query: { courseId, schoolId, departmentId } });
/** CourseUnitService#update keeps the course and code, and always writes `optional`. */
export const updateCourseUnit = (id: string, body: Partial<CourseUnit>) =>
  requestData<CourseUnit>(`/course-units/${id}`, { method: "PUT", body });
export const deleteCourseUnit = (id: string) => requestData<void>(`/course-units/${id}`, { method: "DELETE" });
export const listAssignableLecturers = () => requestData<User[]>("/course-units/lecturers");
export const assignLecturer = (id: string, lecturerId: string) =>
  requestData<CourseUnit>(`/course-units/${id}/assign-lecturer`, { method: "POST", query: { lecturerId } });
/** Marks exactly these units of the course optional (electives); the rest become core. */
export const setOptionalOffering = (courseId: string, optionalUnitIds: string[]) =>
  requestData<CourseUnit[]>("/course-units/optional-offering", { method: "PUT", query: { courseId }, body: optionalUnitIds });

// ---- Academic calendar ----

export const listAcademicYears = () => requestData<AcademicYear[]>("/academic-years/all");
export const createAcademicYear = (body: Partial<AcademicYear>) =>
  requestData<AcademicYear>("/academic-years", { method: "POST", body });
export const updateAcademicYear = (id: string, body: Partial<AcademicYear>) =>
  requestData<AcademicYear>(`/academic-years/${id}`, { method: "PUT", body });
export const deleteAcademicYear = (id: string) => requestData<void>(`/academic-years/${id}`, { method: "DELETE" });
export const setCurrentAcademicYear = (id: string) =>
  requestData<AcademicYear>(`/academic-years/${id}/set-current`, { method: "POST" });
export const listSemesters = (academicYearId: string) =>
  requestData<Semester[]>(`/academic-years/${academicYearId}/semesters`);
export const createSemester = (academicYearId: string, body: Partial<Semester>) =>
  requestData<Semester>(`/academic-years/${academicYearId}/semesters`, { method: "POST", body });
export const deleteSemester = (id: string) => requestData<void>(`/semesters/${id}`, { method: "DELETE" });
export const setCurrentSemester = (id: string) => requestData<Semester>(`/semesters/${id}/set-current`, { method: "POST" });

// ---- Reference data ----

export const listClassrooms = () => requestData<Classroom[]>("/classrooms/all");
export const createClassroom = (campusId: string | undefined, body: Partial<Classroom>) =>
  requestData<Classroom>("/classrooms", { method: "POST", body, query: { campusId } });
export const updateClassroom = (id: string, campusId: string | undefined, body: Partial<Classroom>) =>
  requestData<Classroom>(`/classrooms/${id}`, { method: "PUT", body, query: { campusId } });
export const deleteClassroom = (id: string) => requestData<void>(`/classrooms/${id}`, { method: "DELETE" });

export const listLookupCategories = () => requestData<LookupCategory[]>("/setup/categories");
export const listLookups = (category: string, page: number, limit: number, search?: string) =>
  request<PaginatedResponse<LookupValue[]>>(`/setup/lookups/${category}`, { query: { page, limit, search } });
/** LookupValueRequest: name, code, description, sortOrder, active. */
export const createLookup = (category: string, body: Partial<LookupValue>) =>
  requestData<LookupValue>(`/setup/lookups/${category}`, { method: "POST", body });
export const updateLookup = (category: string, id: string, body: Partial<LookupValue>) =>
  requestData<LookupValue>(`/setup/lookups/${category}/${id}`, { method: "PUT", body });
export const deleteLookup = (category: string, id: string) =>
  requestData<void>(`/setup/lookups/${category}/${id}`, { method: "DELETE" });

export const listExaminations = (page: number, limit: number) =>
  request<PaginatedResponse<Examination[]>>("/setup/examinations", { query: { page, limit } });
export const createExamination = (courseId: string, body: Partial<Examination>) =>
  requestData<Examination>("/setup/examinations", { method: "POST", body, query: { courseId } });
export const updateExamination = (id: string, body: Partial<Examination>) =>
  requestData<Examination>(`/setup/examinations/${id}`, { method: "PUT", body });
export const deleteExamination = (id: string) => requestData<void>(`/setup/examinations/${id}`, { method: "DELETE" });

// ---- Setup reports ----

export const getReportDefinition = (report: string) =>
  requestData<ReportDefinition>(`/setup/reports/${report}/definition`);
export const getReportRows = (report: string, page: number, limit: number, search: string, filters: Record<string, string>) =>
  request<PaginatedResponse<Record<string, string>[]>>(`/setup/reports/${report}`, {
    query: { ...filters, search, page, limit },
  });
export const getReportCsv = (report: string, search: string, filters: Record<string, string>) =>
  requestText(`/setup/reports/${report}/csv`, { query: { ...filters, search } });

// ---- Health ----

/** 200 when PostgreSQL answers, 503 (an ApiError carrying the same body's message) when it doesn't. */
export const databaseHealth = () => request<DatabaseHealth>("/internal/health/database");
