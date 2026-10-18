# MediCore — UI / E2E tests (Playwright)

**SE3112 role: UI / E2E Testing — Chamika Kasthuriarachchi**

Automated browser tests for the MediCore React frontend, in two layers that run from one runner and
produce one report:

| Layer | Project | What runs | Backend | When |
|---|---|---|---|---|
| **UI tests** | `ui-chromium` (+ `ui-firefox`, `ui-webkit`) | The real app (production bundle) in a real browser. Every gateway call is answered by a **test double** | None | Every push / PR (CI), and constantly while developing |
| **E2E tests** | `e2e-stack` (after `e2e-setup`) | The same app against the **real gateway**, driving journeys across Identity → Patient → Appointment → Kafka → Billing | Docker stack | Before a release, in the demo, on demand in CI |

```
                 ┌──────────────── Playwright test runner ────────────────┐
                 │                                                        │
   UI layer      │  Chromium ──► app (vite preview :5199) ──► MockGateway │  (page.route: fake + stub + spy)
                 │                                                        │
   E2E layer     │  Chromium ──► app (vite dev :5173) ──► Gateway :5000 ──┼──► Identity · Patient · Appointment · Billing
                 │                     ▲                                  │         │          │           │
                 │  GatewayClient ─────┘ (health, provisioning, polling)  │         └── Kafka ─┴───────────┘
                 └──────────── HTML · JUnit · JSON reports, traces ───────┘
```

The mocked app is built with a gateway URL that does not exist (`mock-gateway.medicore.test`), so a call
a test forgot to double fails loudly instead of quietly reaching a real backend.

---

## Why Playwright

| Need | How Playwright meets it |
|---|---|
| Isolate the UI from 4 microservices | `page.route` intercepts every request in the browser → stateful test doubles, no proxy server |
| Assert on what the UI *sends*, not only what it shows | Requests are recorded with headers and body (the booking token vs the staff token, normalised payloads) |
| Wait for Kafka-driven state without sleeps | Auto-waiting locators, `expect.poll` with back-off intervals |
| Respect the gateway's rate limits (5 logins/min, 100 req/min per IP) | Sign in **once**, save `storageState`, reuse it in every spec |
| Evidence for the demo and for failures | HTML report with step-by-step traces (DOM snapshots, network, console), screenshots, videos |
| CI | Headless by default, JUnit output, one `npx playwright install` — no driver binaries to pin |
| Accessibility | `@axe-core/playwright` runs WCAG 2 A/AA rules in the same browser session |

The older Selenium suite in `../e2e/` covered three booking cases and is now out of date (it asserts a
"Sprint 4" billing notice the page no longer shows). This package supersedes it.

---

## Running

### Once

```bash
cd medicore-frontend
npm install                    # the app's own dependencies (the tests build and serve it)
cd ui-tests
npm install
npx playwright install chromium        # add firefox webkit for cross-browser runs
```

### UI layer — no backend needed

```bash
npm run test:ui                # headless, ~30 s on a laptop
npm run test:ui:headed         # watch the browser
npm run test:ui:cross-browser  # Chromium + Firefox + WebKit
npm run report                 # open the HTML report
npx playwright test --project=ui-chromium --ui     # Playwright's interactive UI mode
```

### E2E layer — against the running microservices

1. **Start the stack** (in `medicore-backend`): `docker compose up -d --build`. Check
   `http://localhost:5000/health/services` says every service is Healthy.
2. **An Admin account exists.** No users are seeded. If the stack is fresh, create one, then
   optionally run `scripts/seed-local-demo.ps1` for demo data.
3. **Give the suite the credentials**: copy `.env.example` to `.env` and set `E2E_ADMIN_PASSWORD`
   (and `E2E_ADMIN_EMAIL`), or export them in the shell.
4. Run:

```bash
npm run test:e2e               # headless
npm run test:e2e:headed        # for the demo
npm run test:all               # both layers, one report
```

The setup project checks the stack is healthy, signs in once **through the login page**, makes
sure a doctor has free times at least two days out (creating a weekly schedule through the API if
nobody is bookable), and saves the session. A stack that is not ready fails there, with a message
saying what to fix.

Don't run the E2E layer more than about four times a minute. The gateway allows 5 logins per minute
per IP, and each run signs in once.

### Against the live Azure deployment

The same journeys run against production. The browser is on the Static Web App's own origin, so the
gateway's CORS policy allows it. In `.env`, uncomment the live block (`E2E_APP_URL`,
`E2E_GATEWAY_URL`) and set a real Admin account, then run `npm run test:e2e`. Each run leaves one
test patient (surname `E2E…`) and one cancelled appointment. Against the live site, setup never
changes a doctor's schedule unless `E2E_ALLOW_PROVISIONING=1` is set.

### Settings

| Variable | Default | Used by |
|---|---|---|
| `E2E_ADMIN_EMAIL` | `admin@medicore.local` | E2E |
| `E2E_ADMIN_PASSWORD` | — (required) | E2E |
| `E2E_GATEWAY_URL` | `http://localhost:5000` | E2E |
| `E2E_APP_URL` | unset → dev server on `:5173` | E2E: test a deployed frontend instead |
| `E2E_ALLOW_PROVISIONING` | unset | With `E2E_APP_URL`: let setup create a doctor schedule if nobody is bookable (always allowed locally) |
| `E2E_EVENTUAL_TIMEOUT_MS` | `45000` | E2E: how long to wait for Kafka-driven state |
| `UI_MOCK_PORT` / `E2E_APP_PORT` | `5199` / `5173` | ports of the two app servers |
| `PW_CHROMIUM_PATH` | unset | use a pre-installed Chromium |

---

## What is tested

### UI layer — 68 tests, 6 specs (`tests/ui/`)

| Spec | Covers |
|---|---|
| `auth.spec.ts` | Every role lands on its home page after login (data-driven, 4 roles), and the request body and stored session are checked. Also: wrong password, button locked in flight, password reveal, logout clears the session, 6 protected routes redirect anonymous visitors, `/book` is public |
| `rbac-navigation.spec.ts` | The sidebar shows **exactly** the pages each of the 5 roles may open, matching App.tsx and the backend policies. 7 forbidden URLs bounce. Active-link highlighting |
| `booking-flow.spec.ts` | Returning patient books end to end, sending the **booking token** (not a staff token) and the derived service code. The booked slot leaves the listing. Vague "not found" message (no patient-number oracle). New patient registers and books; input is normalised before sending. **7 parameterised validation rules**. Duplicate NIC. Specialization filter. No doctors / no slots. **409 slot race recovery** keeps the patient and reloads the times. **401 expired token** sends the patient back to identify. 503 from the slot service. "Change patient" forgets the token |
| `patient-registration.spec.ts` | Front-desk registration happy path, with normalisation and the receptionist's token. Duplicate NIC shows the existing record. Server 400 errors mapped back onto fields. 403. All 9 required fields. Errors clear on edit. No double submit |
| `appointment-management.spec.ts` | Clinic list → row menu → details. Draft invoice link and invoice page. **Invoice not created yet (eventual consistency)** → page still works. Staff cancel with reason → history. 24-hour-window refusal. Reason required |
| `accessibility.spec.ts` | axe-core WCAG 2 A/AA scan of landing, login, booking identify and slot picker (gate: zero *critical*). Keyboard-only booking |

### E2E layer — `tests/e2e/`

| Spec | Journey |
|---|---|
| `global.setup.ts` | Stack health, one real login, doctor availability (provisioned if missing), saved session |
| `patient-journey.e2e.ts` | **Front desk registers** a patient (Patient) → **search** finds them by NIC → patient **books on the public page** in a separate anonymous browser, with the booking token the Patient service minted (Appointment) → the slot leaves the public listing → booking shows in the **clinic list** → **Billing creates a draft invoice** from the Kafka event → staff **cancel**, the slot is released → **Billing voids the invoice** with the cancellation reason |
| `token-boundaries.e2e.ts` | The booking token minted by the Patient service is honoured by the Appointment service for the patient's own bookings, and **refused** on the staff list (Appointment), patient search (Patient) and staff data (Identity). It never touches browser storage |

---

## How it is built

```
ui-tests/
  playwright.config.ts     projects, two web servers, reporters, trace/video policy
  support/env.ts           every setting, overridable; loads .env
  mocks/
    mock-gateway.ts        the test double: fake (state) + stub (overrides) + spy (recorded calls)
    data.ts                builders for users, doctors, slots, patients — dates relative to today
  fixtures/ui-test.ts      `test` extended with gateway, signInAs, page objects, scanA11y
  pages/                   page objects — locate by role / label / test id, never by CSS class
  support/
    gateway-client.ts      real-gateway client for setup, provisioning and polling
    test-data.ts           a unique patient per E2E run (NIC and email are unique-indexed)
    dates.ts               Colombo-time helpers that agree with the app
  tests/ui/                UI layer specs
  tests/e2e/               E2E layer: setup + journeys
```

Techniques worth knowing:

- **Test doubles at the network edge.** `MockGateway` is one `page.route` handler. It acts as a
  **fake** (it keeps free slots and bookings, so booking really removes a slot), a **stub** (any test
  overrides one endpoint with `gateway.on(...)` to force a 409, 401, 503 or a delay), and a **spy**
  (every call is recorded and attached to the report). After each test the fixture fails if the UI
  called an endpoint nobody doubled.
- **Contract assertions.** Tests check what left the browser, not only the screen. For example, the
  booking request carries `Bearer booking-token-…` and no patient id, and the NIC is upper-cased
  before it is sent.
- **Data-driven tests.** Roles, forbidden routes and validation rules are tables. Each row is its
  own named test.
- **Page Object Model with user-facing locators.** `getByRole`, `getByLabel`, `getByTestId`.
  Restyling the app does not break the tests.
- **Production bundle under test.** The UI layer builds the app (`vite build`) and serves it with
  `vite preview`, which is what Azure Static Web Apps serves, rather than the dev server.
- **Eventual consistency without sleeps.** Kafka-driven state is polled cheaply through the gateway
  with back-off (`expect.poll`, intervals of 1, 2, 3 and 5 s), then verified once in the UI.
- **Pinned clock zone.** Every browser runs in `Asia/Colombo`, so date logic behaves the same on
  every machine and in CI.
- **No retries for E2E.** A retried journey would book twice and hide the first failure. The UI layer
  retries once in CI only, and the report marks any retried test as flaky.

## Reports and evidence

After any run:

- `reports/html/`: the HTML report (`npm run report`). Each test shows its steps, attachments
  (`gateway-calls.json`, `axe-results.json`) and, for failures, a trace, screenshot and video.
- `reports/junit/results.xml`: for CI summaries.
- `reports/results.json`: machine-readable results.
- `npx playwright show-trace reports/artifacts/<test>/trace.zip`: time-travel debugging.

## Findings so far

- **Accessibility (axe, serious):** insufficient colour contrast on the landing page (2 elements) and
  the booking page (4). The booking summary's `<dl>` wraps each `<dt>/<dd>` pair in extra
  `<div>`s with icons, which breaks `definition-list`/`dlitem` (11 nodes). These are reported, not
  gated. Only *critical* findings fail the build.
- **Stale Selenium suite:** `../e2e/specs/book-appointment.e2e.js` expects "Sprint 4" in the billing
  notice, which the page no longer says, so it fails against the current app.

## CI

`.github/workflows/ui-e2e-tests.yml` runs on every PR to `main`/`develop` and every push to
`develop`. It type-checks the tests, runs the UI layer, publishes a JUnit summary and uploads the HTML
report.

**Deploy gate.** On a push to `main`, `azure-static-web-apps.yml` calls the same workflow first
(`uses: ./.github/workflows/ui-e2e-tests.yml`). Its `build_and_deploy` job `needs` that job, so
a failing UI test stops the deployment to Azure.

**E2E in CI.** Actions → *UI & E2E tests (Playwright)* → *Run workflow* → tick `run_e2e`. The
`app_url` and `gateway_url` inputs default to the live Azure site, and the job reads the admin
account from the repository secrets `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD`. Another workflow
can reuse it through `workflow_call` with its own `app_url`/`gateway_url`. Leave `app_url` empty to
start a dev server in the runner instead.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Setup: "gateway … is not healthy" | The stack is down or a service is unhealthy. Check `docker compose ps` and `/health/services` |
| Setup: "The login page refused …" | Wrong admin password, or `Too many requests` after more than 5 logins in a minute. Wait 60 s |
| Setup: "No doctors reached the appointment service" | Doctor cache empty. Create a doctor on the Staff page or run `seed-local-demo.ps1` |
| Journey stops at "Billing never created an invoice" | `billing-api` is not consuming `appointment-events`. Check its logs in Seq |
| Every E2E request fails CORS | The app is not on `localhost:5173`, the origin the gateway allows. Another process holds the port |
| UI test fails with "The UI called endpoints this test does not know about" | The app started calling a new endpoint. Add a default to `MockGateway` or a `gateway.on(...)` in the test |
| `Executable doesn't exist` | Run `npx playwright install chromium` |
