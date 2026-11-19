// Shapes of the Admissions Core API, mirrored from the Java DTOs and entities under
// com.bugema.admissions.core.{dto,model}. Keep these in step with the backend.

export const USER_ROLES = [
  "APPLICANT",
  "STUDENT",
  "LECTURER",
  "FINANCE",
  "REGISTRAR",
  "ADMISSIONS_OFFICER",
  "ADMIN",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  APPLICANT: "Applicant",
  STUDENT: "Student",
  LECTURER: "Lecturer",
  FINANCE: "Finance Officer",
  REGISTRAR: "Registrar",
  ADMISSIONS_OFFICER: "Admissions Officer",
  ADMIN: "Administrator",
};

/** Roles an admin may create directly; applicants self-register (AdminController#createUser). */
export const STAFF_ROLES: UserRole[] = USER_ROLES.filter((r) => r !== "APPLICANT");

export const ACCOUNT_STATUSES = ["PENDING", "APPROVED", "SUSPENDED", "DISABLED"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/** Jackson writes LocalDateTime as an ISO string by default; tolerate the array form too. */
export type ApiDateTime = string | number[] | null;

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: UserRole;
  enabled: boolean;
  accountStatus: AccountStatus;
  createdAt?: ApiDateTime;
  lastLogin?: ApiDateTime;
}

export interface CreateUserRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: UserRole;
  enabled: boolean;
  password: string;
}

/** Blank password = keep the current one (UserService#updateUser). */
export type UpdateUserRequest = Omit<CreateUserRequest, "password"> & { password?: string };

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T;
  meta: { timestamp: string; version: string; pagination: Pagination };
}

export interface ErrorResponse {
  success: false;
  message?: string;
  errors?: { field: string; code: string; message: string }[];
}

export interface AuthenticationResponse {
  token: string;
  type: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  expiresIn: string;
  refreshToken?: string;
  refreshExpiresIn?: string;
}

export const PERMISSION_GROUPS = ["REPORT", "TRANSACTION", "MASTER", "ONLINE", "PORTAL", "SHARED"] as const;
export type PermissionGroup = (typeof PERMISSION_GROUPS)[number];

export interface Permission {
  key: string;
  moduleKey: string;
  displayName: string;
  description?: string;
  group: PermissionGroup;
  sensitive: boolean;
}

export interface CatalogModule {
  key: string;
  displayName: string;
  description?: string;
  icon?: string;
  order: number;
  permissions: Permission[];
}

export interface GrantSet {
  moduleKeys: string[];
  excludedPermissionKeys: string[];
  permissionKeys: string[];
  roleTemplateKeys: string[];
}

export interface UserAccessGrant extends GrantSet {
  userId: string;
  effectivePermissionKeys: string[];
  updatedAt?: ApiDateTime;
}

export interface BulkGrantRequest {
  userIds: string[];
  grants: GrantSet;
  mode: "ADD" | "REPLACE";
}

export interface RoleTemplate {
  id: string;
  key: string;
  displayName: string;
  description?: string;
  permissionKeys: string[];
  parentKey?: string | null;
  createdAt?: ApiDateTime;
  updatedAt?: ApiDateTime;
}

export type RoleTemplateRequest = Omit<RoleTemplate, "id" | "createdAt" | "updatedAt">;

export interface Campus {
  id: string;
  code: string;
  name: string;
  location?: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  daySchedule?: string;
  eveningSchedule?: string;
  active: boolean;
}

export interface Intake {
  id: string;
  name: string;
  month: string;
  year: number;
  active: boolean;
  /** LocalDate, "YYYY-MM-DD". */
  startDate?: string | null;
  endDate?: string | null;
  applicationDeadline?: string | null;
}

export interface AuditLog {
  id: string;
  action: string;
  performedBy?: Pick<User, "id" | "email" | "firstName" | "lastName"> | null;
  targetUser?: Pick<User, "id" | "email" | "firstName" | "lastName"> | null;
  entityType?: string | null;
  entityId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  timestamp: ApiDateTime;
}

/** Every action AuditLogService records today (grep `logUserAction("` in the backend). */
export const AUDIT_ACTIONS = [
  "USER_CREATED",
  "USER_UPDATED",
  "USER_APPROVED",
  "USER_REJECTED",
  "USER_SUSPENDED",
  "USER_REACTIVATED",
  "USER_DEACTIVATED",
  "ACCESS_GRANT_UPDATED",
  "PASSWORD_CHANGED",
  "PASSWORD_RESET",
] as const;

export interface AdminHealth {
  status: string;
  message: string;
  timestamp: number;
}
