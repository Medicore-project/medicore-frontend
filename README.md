# MediCore — Frontend

The web app for **MediCore**, a hospital management system built for the SE3022 group project. Staff sign in to a workspace that adapts to their role: Admin, Doctor, Nurse or Receptionist. Patients book appointments from a public page, with no account needed.

The app talks only to the **API gateway** of the [`medicore-backend`](../medicore-backend) repository. You need that backend running to use any page beyond the landing page.

---

## Tech stack

- **React 19** + **TypeScript**, built with **Vite 8**
- **React Router 7**, using nested protected routes
- **axios**: one shared client that attaches the JWT and refreshes it when it expires
- **Recharts** for dashboard and report charts
- **Plain CSS**, with no UI library and no Tailwind
- **Vitest** + Testing Library + jsdom for tests, and **oxlint** for linting
- Selenium end-to-end tests in a separate package under [`e2e/`](e2e/README.md)

## Features

| Area | Pages | Who sees it |
|---|---|---|
| **Public** | Landing page, staff login, public appointment booking (`/book`) | Everyone |
| **Dashboard** | Today's schedule, KPIs, activity charts | All staff |
| **Patients** | Search, registration, profile, medical records with version history, prescriptions, allergies | Clinical and front-desk staff (only Doctors and Nurses can write medical records) |
| **Appointments** | Doctor schedules and slots, in-app booking, booked appointments, reschedule and cancel, waitlist, doctor leave | All staff can view. Admin and Receptionist manage schedules and change bookings; leave is Admin and Doctor |
| **Billing** | Service tariffs and invoices; notification log | Admin and Receptionist; notification log Admin only |
| **Staff & organisation** | Staff list and detail, role assignment; departments, specializations | Staff: Admin only. Departments and specializations: Admin edits, Receptionist views |
| **Reports** | Demographics, utilisation, revenue, outstanding payments (each exportable), audit | Admin only |

Role checks in the UI only **hide** controls. The backend enforces every permission itself. The role lists in `src/utils/permissions.ts` copy the backend's authorization policies and say which policy each one mirrors.

---

## Getting started

### Prerequisites

- **Node.js 20** (the version CI uses) and npm
- The backend running locally, with its gateway at `http://localhost:5000`. See the backend README: `docker compose up -d --build`.

### Install and run

```bash
npm install
npm run dev
```

Vite serves the app at **http://localhost:5173**. The gateway's local CORS settings already allow that origin.

Run `npm install` again after pulling. `node_modules` is often stale, and tests fail with missing `vitest`/`jsdom` until you do.

### Pointing at a backend

The API address is read at **build time** from `VITE_API_BASE_URL`:

| Value | Result |
|---|---|
| Not set | Defaults to `http://localhost:5000`, the local gateway. This is right for local development. |
| `https://medicore-gateway.azurewebsites.net` | Uses the production gateway (this is the value in `.env.example`) |

To override it locally, create `.env.local`. Files ending in `.local` are ignored by git:

```bash
echo "VITE_API_BASE_URL=http://localhost:5000" > .env.local
```

Always point at the **gateway**, never directly at a service on `:5002`–`:5004`. Only the gateway has CORS configured, so direct calls fail their preflight.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-checks (`tsc -b`) and builds to `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm run lint` | Runs oxlint |
| `npm test` | Runs every Vitest test once |

```bash
npx vitest run src/api/demographicsReports.test.ts   # one file
npx vitest run -t "renders the summary"              # tests whose name matches
```

End-to-end tests drive a real Chrome against a running stack and book real appointments. Read [`e2e/README.md`](e2e/README.md) before running them.

---

## Project structure

```
src/
  main.tsx, App.tsx      entry point and the route table
  api/                   one typed module per backend area, plus the shared client
    client.ts            the axios client: JWT, X-Correlation-Id, refresh-on-401 queue
    bookingToken.ts      the separate token used by the public booking flow
  contexts/AuthContext.tsx   signed-in user, login and logout
  routes/ProtectedRoute.tsx  redirects signed-out users and users without an allowed role
  pages/                 one component per route, with tests alongside
  components/
    layout/              AppLayout, Sidebar, Header, command palette, navigation config
    booking/             the multi-step public and in-app booking flow
    appointments/, patients/, dashboard/, landing/, common/, motion/, icons/
  hooks/                 data hooks (dashboard, in-view animation)
  utils/                 permissions, API error handling, downloads, formatting
  *.css                  index.css holds the shared classes; feature stylesheets sit beside it
  test/setup.ts          Vitest setup
public/
  staticwebapp.config.json   Azure Static Web Apps routing fallback and security headers
e2e/                     Selenium tests, a separate npm package
```

## Conventions

- **Always use `apiClient` from `src/api/client.ts`**, never `axios` directly. It adds auth, correlation IDs and token refresh.
- Each API module exports an object, such as `prescriptionApi`, and uses **gateway-prefixed paths**, such as `/patient/api/patients/${id}/prescriptions`. The prefix (`/identity`, `/patient`, `/appointment`, `/billing`) tells the gateway which service to call.
- Routes nest `<ProtectedRoute allowedRoles={[...]}>`, then `<AppLayout>`, then the page. Role constants come from `src/utils/permissions.ts`.
- Styling uses the shared classes in `src/index.css`, such as `btn btn-primary`, `card`, `badge` and `alert-danger`, before adding new CSS.
- The public booking flow uses its own short-lived token. `client.ts` sends it only to an allow-list of booking routes, so a patient's token never reaches staff endpoints.

---

## Deployment

The app is hosted on **Azure Static Web Apps**. `.github/workflows/azure-static-web-apps.yml` runs on every push to `main`: it runs `npm ci` and `npm run build`, then uploads `dist/`.

Set these repository secrets:

| Secret | Purpose |
|---|---|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Deploy token from the Static Web App in the Azure portal |
| `VITE_API_BASE_URL` | Production gateway URL, baked into the build |

`public/staticwebapp.config.json` sends unknown paths to `index.html`, so client-side routes survive a refresh. It also adds the `nosniff`, `X-Frame-Options: DENY` and referrer-policy headers.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| **"Network Error"** on login or any page | The browser got no usable response. The gateway or a service is down: locally the containers aren't running, and in Azure the App Service is stopped (it answers `403 Site Disabled`). It can also be a CORS rejection. Check the gateway URL directly before debugging the frontend. |
| Every request fails a CORS preflight | `VITE_API_BASE_URL` points at a service instead of the gateway, or the dev server is on an origin the gateway doesn't allow. |
| The booking page shows no doctors | The backend's appointment service has an empty doctor cache. See the backend README's troubleshooting section. |
| `npm test` can't find `vitest` or `jsdom` | Run `npm install`. |
| A change to `VITE_API_BASE_URL` has no effect | It's read at build time. Restart `npm run dev`, or rebuild. |

## Contributing

- Work happens on feature branches named after the Jira ticket. Changes reach `develop` and then `main` through pull requests.
- Commits follow Conventional Commits: `feat(SCRUM-32): …`, `fix: …`, `chore: …` and `refactor(<area>): …`.
- Run `npm run lint`, `npm test` and `npm run build` before opening a pull request.
