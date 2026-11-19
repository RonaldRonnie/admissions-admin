import { request, requestData } from "./client";
import type {
  AdminHealth,
  AuditLog,
  AuthenticationResponse,
  BulkGrantRequest,
  Campus,
  CatalogModule,
  CreateUserRequest,
  GrantSet,
  Intake,
  PaginatedResponse,
  PermissionGroup,
  RoleTemplate,
  RoleTemplateRequest,
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
