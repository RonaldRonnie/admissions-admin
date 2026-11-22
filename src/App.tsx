import type { ReactNode } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import { AccountPage } from "./pages/AccountPage";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { AuditLogPage } from "./pages/AuditLogPage";
import { CampusesPage } from "./pages/CampusesPage";
import { CatalogPage } from "./pages/CatalogPage";
import { DashboardPage } from "./pages/DashboardPage";
import { IntakesPage } from "./pages/IntakesPage";
import { LoginPage } from "./pages/LoginPage";
import { RoleTemplatesPage } from "./pages/RoleTemplatesPage";
import { UserAccessPage } from "./pages/UserAccessPage";
import { UsersPage } from "./pages/UsersPage";
import { AcademicCalendarPage } from "./pages/org/AcademicCalendarPage";
import { CoursesPage } from "./pages/org/CoursesPage";
import { CourseUnitsPage } from "./pages/org/CourseUnitsPage";
import { DepartmentsPage } from "./pages/org/DepartmentsPage";
import { SchoolsPage } from "./pages/org/SchoolsPage";
import { ReportsPage } from "./pages/oversight/ReportsPage";
import { SystemHealthPage } from "./pages/oversight/SystemHealthPage";
import { ClassroomsPage } from "./pages/reference/ClassroomsPage";
import { ExaminationsPage } from "./pages/reference/ExaminationsPage";
import { LookupsPage } from "./pages/reference/LookupsPage";

function RequireSession({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const location = useLocation();
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

// HashRouter, because GitHub Pages has no server-side fallback: a refresh on /users would 404,
// while /#/users always loads index.html.
export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireSession>
              <Layout />
            </RequireSession>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="users/:id/access" element={<UserAccessPage />} />
          <Route path="approvals" element={<ApprovalsPage />} />
          <Route path="access/templates" element={<RoleTemplatesPage />} />
          <Route path="access/catalog" element={<CatalogPage />} />
          <Route path="campuses" element={<CampusesPage />} />
          <Route path="intakes" element={<IntakesPage />} />
          <Route path="schools" element={<SchoolsPage />} />
          <Route path="departments" element={<DepartmentsPage />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="course-units" element={<CourseUnitsPage />} />
          <Route path="calendar" element={<AcademicCalendarPage />} />
          <Route path="classrooms" element={<ClassroomsPage />} />
          <Route path="lookups" element={<LookupsPage />} />
          <Route path="examinations" element={<ExaminationsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="health" element={<SystemHealthPage />} />
          <Route path="audit" element={<AuditLogPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
