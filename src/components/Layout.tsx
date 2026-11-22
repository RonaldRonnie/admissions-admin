import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listPendingUsers } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { fullName } from "../lib/format";

const NAV: { section: string; items: { to: string; label: string; end?: boolean }[] }[] = [
  {
    section: "Overview",
    items: [
      { to: "/", label: "Dashboard", end: true },
      { to: "/health", label: "System health" },
    ],
  },
  {
    section: "People",
    items: [
      { to: "/users", label: "Users" },
      { to: "/approvals", label: "Pending approvals" },
    ],
  },
  {
    section: "Access control",
    items: [
      { to: "/access/templates", label: "Role templates" },
      { to: "/access/catalog", label: "Permission catalog" },
    ],
  },
  {
    section: "Organisation",
    items: [
      { to: "/schools", label: "Schools" },
      { to: "/departments", label: "Departments" },
      { to: "/courses", label: "Courses" },
      { to: "/course-units", label: "Course units" },
    ],
  },
  {
    section: "Setup",
    items: [
      { to: "/calendar", label: "Academic calendar" },
      { to: "/campuses", label: "Campuses" },
      { to: "/classrooms", label: "Buildings & classrooms" },
      { to: "/intakes", label: "Intakes" },
      { to: "/examinations", label: "Examinations" },
      { to: "/lookups", label: "Reference lists" },
    ],
  },
  {
    section: "Oversight",
    items: [
      { to: "/reports", label: "Setup reports" },
      { to: "/audit", label: "Audit log" },
    ],
  },
];

export function Layout() {
  const { session, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const pending = useQuery({ queryKey: ["users", "pending"], queryFn: listPendingUsers });
  const pendingCount = pending.data?.length ?? 0;

  return (
    <div className="min-h-screen lg:flex">
      <header className="flex items-center justify-between bg-brand-900 px-4 py-3 text-white lg:hidden">
        <span className="font-semibold">Admissions Admin</span>
        <button onClick={() => setMenuOpen((open) => !open)} className="rounded px-2 py-1 hover:bg-white/10" aria-expanded={menuOpen}>
          {menuOpen ? "Close" : "Menu"}
        </button>
      </header>

      <aside
        className={`${menuOpen ? "block" : "hidden"} bg-brand-900 text-slate-200 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col`}
      >
        <div className="hidden px-5 pt-6 pb-4 lg:block">
          <p className="text-xs font-medium tracking-wider text-slate-400 uppercase">Bugema University</p>
          <p className="text-lg font-semibold text-white">Admissions Admin</p>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 lg:py-2" aria-label="Main">
          {NAV.map((group) => (
            <div key={group.section}>
              <p className="px-2 pb-1 text-xs font-semibold tracking-wider text-slate-400 uppercase">{group.section}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between rounded-md px-2 py-1.5 text-sm ${
                      isActive ? "bg-white/15 font-medium text-white" : "hover:bg-white/10 hover:text-white"
                    }`
                  }
                >
                  {item.label}
                  {item.to === "/approvals" && pendingCount > 0 && (
                    <span className="rounded-full bg-amber-400 px-1.5 text-xs font-semibold text-brand-900">{pendingCount}</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 px-5 py-4 text-sm">
          <p className="truncate font-medium text-white">{fullName(session?.user)}</p>
          <p className="truncate text-xs text-slate-400">{session?.user.email}</p>
          <div className="mt-3 flex gap-3 text-xs">
            <NavLink to="/account" onClick={() => setMenuOpen(false)} className="text-slate-300 hover:text-white">
              My password
            </NavLink>
            <button onClick={signOut} className="text-slate-300 hover:text-white">
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
