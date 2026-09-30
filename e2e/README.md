# MediCore end-to-end tests

Selenium tests for the SCRUM-34 public booking flow, driving a real Chrome against a running stack.

A **separate npm package** from the frontend on purpose:

- `npm test` in the frontend must stay `vitest run` — fast, no browser, no stack. It is what gets
  run constantly.
- These dependencies must not enter the frontend's `tsc -b` graph or its production build.
- The frontend pins its own TypeScript; this package has no build step at all, which is why the
  specs are plain ESM JavaScript.

It is **not wired into CI**. There is no appointment CI workflow yet, and a suite that books real
appointments needs a seeded database that CI does not have.

---

## What you need first

These tests book real appointments in whatever database the app is pointed at. All four things below
must be true or the suite fails in ways that look like bugs in the app.

**1. The stack is up and current.**

```bash
cd medicore-backend
docker compose up -d --build appointment-api patient-api
```

The rebuild is not optional. The `appointment-api` container has been running a pre-SCRUM-33 image,
which serves none of the booking endpoints.

**2. The doctor cache has been backfilled — the one people forget.**

```
POST /identity/api/staff/doctors/republish      (as Admin, once)
```

The appointment service keeps its own copy of doctor data, fed by Kafka events. Kafka's retention is
seven days, so doctors created in earlier sprints are not in it. **Without this the booking page
lists zero doctors**, and the failure reads like a SCRUM-34 bug rather than a missing backfill. The
first spec's assertion message says so too.

**3. Some doctor has a future schedule**, so there are slots to book. Create one on the
Appointments page if not.

**4. The frontend is running and points at the gateway.**

```bash
cd medicore-frontend
npm run dev
```

CORS is configured **only** on the gateway (`:5000`); the patient and appointment services have none
of their own. If `VITE_API_BASE_URL` points straight at `:5002` or `:5003`, every call fails a
preflight before a single assertion runs.

---

## Running

```bash
cd medicore-frontend/e2e
npm install

# A patient who already exists, for the returning-patient spec.
export E2E_PATIENT_NUMBER=PAT-000123
export E2E_PATIENT_DOB=1995-04-02

npm test              # watch it happen
HEADLESS=1 npm test   # no visible browser
```

There is no chromedriver to install or pin: `selenium-webdriver` v4 resolves it through Selenium
Manager, matching whatever Chrome is installed. That is the main reason this suite should not rot.

### Settings

| Variable | Default | What it is |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:5173` | Where the app is served |
| `E2E_PATIENT_NUMBER` | — | **Required.** An existing patient's number |
| `E2E_PATIENT_DOB` | — | **Required.** That patient's date of birth, `YYYY-MM-DD` |
| `HEADLESS` | unset | `1` to run without a window |
| `E2E_WAIT_TIMEOUT` | `15000` | Milliseconds to wait for an element |

Both patient variables are required together, and deliberately so: a patient number identifies
nobody on its own. The suite fails with an explanation rather than a timeout if either is missing.

---

## What the specs cover

| Spec | What it proves |
|---|---|
| A returning patient books | Identify → pick a doctor → pick a time → confirm. The patient number stays on screen, the confirmation appears, the Sprint-4 billing notice is shown, and **the booked time is no longer offered** — SCRUM-34 AC1, observed through the browser instead of the database |
| A new patient registers and books | The demographics form issues a patient number, and that number survives the booking unchanged — the thing the patient has to leave with |
| An unknown patient number is refused | The error says only that no patient matched, never that the number exists but the date was wrong. Patient numbers are sequential, so the difference would be a confirmation oracle |

## Conventions

- **Selectors are `data-testid` or the form controls' own `id`, never a CSS class.** This app is
  restyled routinely; a suite coupled to the stylesheet would break on work that changed no
  behaviour.
- **Specs run serially** (`parallel: false`). They book real slots from a shared database, so two
  running at once would race for the same time and produce a false 409.
- **The new-patient spec builds a fresh NIC every run** from the clock. The NIC is unique-indexed,
  so a fixed one would register once and 409 on every run after.
- Nothing is cleaned up afterwards. These are real appointments in a development database; delete
  them by hand if they get in the way.
