# Admissions Admin

A web console for the system administrators of the
[Bugema University Admissions Core](https://github.com/bugemaUniversityMail/Admissions-Core) API.
It is a static site (React + TypeScript + Vite), built and published to GitHub Pages by
`.github/workflows/deploy.yml`. It holds no secrets: an administrator signs in with their own
account and the API decides what they may do.

## What it covers

| Area | What you can do | API |
|---|---|---|
| Dashboard | API health, account counts, recent activity | `/api/admin/health`, `/api/admin/users`, `/api/audit-logs` |
| System health | API and PostgreSQL status, catalog size, administrator count, current academic year; refreshes every 30 s | `/api/admin/health`, `/api/internal/health/database` |
| Users | Search and filter every account; create staff accounts; edit details and role; reset a password; suspend, disable, reactivate; export the filtered list as CSV | `/api/admin/users` |
| Pending approvals | Approve self-registered staff (optionally changing their role) or reject them | `/api/admin/users/pending`, `…/approve`, `…/reject` |
| Access | Per-user module and permission grants and role templates, with a live preview of the effective permissions and derived office roles before saving; bulk grants to many users at once. Admin modules are locked to ADMIN accounts and the student portal to STUDENT accounts, as the API enforces | `/api/admin/access-control/**` |
| Role templates | Create and edit reusable permission bundles, with inheritance | `/api/admin/access-control/role-templates` |
| Permission catalog | Browse every permission by module, group and sensitivity | `/api/admin/access-control/catalog` |
| Campuses, intakes | Create, edit, deactivate and reactivate | `/api/admin/campuses`, `/api/admin/intakes` |
| Schools, departments | Create, edit, delete; set the dean of a school and the head of a department (the Dean and Department modules' scope) | `/api/schools`, `/api/departments` |
| Courses, course units | Create, edit, delete; assign a unit's lecturer; mark which units of a course are electives | `/api/courses`, `/api/course-units` |
| Academic calendar | Academic years and their semesters; set the current year and semester | `/api/academic-years`, `/api/semesters` |
| Buildings & classrooms | Rooms by campus and building, for the timetable | `/api/classrooms` |
| Examinations | Schedule CATs, midterms, finals and practicals per course and term | `/api/setup/examinations` |
| Reference lists | The Setup module's pick-lists (banks, religions, sponsors, …) | `/api/setup/categories`, `/api/setup/lookups/{list}` |
| Setup reports | The nine Setup reports, with filters, search and CSV export | `/api/setup/reports/{report}` |
| Audit log | Every account and access change, filterable by action, exportable as CSV | `/api/audit-logs` |
| My password | Change your own password | `/api/auth/change-password` |

Only accounts the API treats as administrators can sign in: after the password check, the console
calls `/api/admin/health`, which answers only to admins, and refuses everyone else.

## Run it locally

```bash
npm install
cp .env.example .env.local      # points at http://localhost:8080/api by default
npm run dev                     # http://localhost:5173
```

The API's `dev` profile already allows `http://localhost:5173`, so no CORS change is needed
locally. You need an ADMIN account; see the API's `scripts/README.md` for creating the first one.

```bash
npm test          # unit tests (API client, CSV, form rules, effective-permission preview)
npm run build     # type-check and build into dist/
```

## Publish to GitHub Pages

1. Push this repository to GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. **Settings → Secrets and variables → Actions → Variables**: add `API_BASE_URL`, e.g.
   `https://your-api.onrender.com/api` (including `/api`, no trailing slash).
4. Push to `main`, or run the workflow by hand from the Actions tab.

The console appears at `https://<owner>.github.io/<repo>/`.

### Let the API accept the console

Browsers refuse cross-origin calls unless the API allows them. Add the Pages origin (scheme and
host only, no path, no trailing slash) to the API's `ALLOWED_ORIGINS` on Render, alongside the
main frontend, then redeploy the API:

```
ALLOWED_ORIGINS=https://your-frontend.example.org,https://<owner>.github.io
```

If sign-in says it "cannot reach the API", this is almost always the cause.

## Security notes

- The session token is kept in `sessionStorage`: closing the tab signs you out, and nothing
  persists on a shared machine.
- The site sets `noindex` so search engines don't list it. Being public doesn't expose anything:
  every request still needs an admin's token, and the API enforces every rule itself.
- Account suspension and access changes take effect on the user's very next request; the API
  re-checks the account on each one.

## Project layout

```
src/
  api/          client (fetch + token refresh), endpoint functions, types mirrored from the Java DTOs
  auth/         sign-in/out and the admin-access check
  components/   layout, shared UI (table card, field-driven form modal), the grants editor and permission picker
  pages/        one file per screen; users/ holds the account forms and actions, org/ schools to the
                academic calendar, reference/ rooms, lists and exams, oversight/ reports and health
  lib/          formatting, CSV export, and rules mirrored from the backend (validation, effective access)
```

When the backend's DTOs change, update `src/api/types.ts` to match.
