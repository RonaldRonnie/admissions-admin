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
| Users | Search and filter every account; create staff accounts; edit details, role and password; suspend, disable, reactivate | `/api/admin/users` |
| Pending approvals | Approve self-registered staff (optionally changing their role) or reject them | `/api/admin/users/pending`, `…/approve`, `…/reject` |
| Access | Per-user module and permission grants, role templates, effective permissions; bulk grants to many users at once | `/api/admin/access-control/**` |
| Role templates | Create and edit reusable permission bundles, with inheritance | `/api/admin/access-control/role-templates` |
| Permission catalog | Browse every permission by module, group and sensitivity | `/api/admin/access-control/catalog` |
| Campuses, intakes | Create, edit, deactivate and reactivate | `/api/admin/campuses`, `/api/admin/intakes` |
| Audit log | Every account and access change, filterable by action | `/api/audit-logs` |
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
npm test          # unit tests (API client, formatting)
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
  components/   layout, shared UI, the grants editor and permission picker
  pages/        one file per screen; users/ holds the account forms and actions
  lib/          formatting and validation rules mirrored from the backend
```

When the backend's DTOs change, update `src/api/types.ts` to match.
