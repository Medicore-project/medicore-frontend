import { defineConfig, devices } from '@playwright/test';
import { env } from './support/env';

/**
 * MediCore UI / E2E test configuration (SE3112 — UI / E2E Testing role).
 *
 * Two layers, one runner, one report:
 *
 *  ui-*        UI tests. The real React app runs in a real browser, but every call to the API
 *              gateway is answered by a test double (Playwright network interception). Fast,
 *              deterministic, no backend needed — this is what CI runs on every push.
 *
 *  e2e-stack   End-to-end tests. The same app pointed at the real gateway, driving workflows that
 *              cross Identity → Patient → Appointment → Kafka → Billing. Needs the docker stack.
 *
 * The two layers are served by two Vite dev servers so they can never be confused: the mocked one
 * points at a gateway hostname that does not exist, so a call the test forgot to mock fails loudly
 * instead of silently reaching a real backend.
 */

const isCI = !!process.env.CI;

/** Lets a machine with a pre-installed Chromium skip `npx playwright install`. */
const chromiumLaunch = env.chromiumPath ? { executablePath: env.chromiumPath } : {};

export default defineConfig({
  testDir: './tests',
  outputDir: './reports/artifacts',

  // Fail the build if someone leaves a test.only behind.
  forbidOnly: isCI,
  fullyParallel: true,
  workers: isCI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 7_000 },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['junit', { outputFile: 'reports/junit/results.xml' }],
    ['json', { outputFile: 'reports/results.json' }],
  ],

  use: {
    // Evidence for every failure: a full trace (DOM snapshots, network, console), a screenshot and
    // a video. Kept only when something fails, so a green run stays small.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // The clinic runs on Colombo time; pin it so date logic is the same on every machine and in CI.
    timezoneId: 'Asia/Colombo',
    locale: 'en-GB',
    viewport: { width: 1440, height: 900 },
    testIdAttribute: 'data-testid',
  },

  projects: [
    // ── Layer 1: UI tests against API test doubles ─────────────────────────────
    {
      name: 'ui-chromium',
      testDir: './tests/ui',
      retries: isCI ? 1 : 0,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        baseURL: env.mockAppUrl,
        launchOptions: chromiumLaunch,
      },
    },
    {
      name: 'ui-firefox',
      testDir: './tests/ui',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 }, baseURL: env.mockAppUrl },
    },
    {
      name: 'ui-webkit',
      testDir: './tests/ui',
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 }, baseURL: env.mockAppUrl },
    },

    // ── Layer 2: full-stack E2E against the running microservices ──────────────
    {
      // Checks the stack is up and provisions what the journey needs (a bookable doctor), and signs
      // in once. Every e2e spec depends on it, so a dead stack fails here with one clear message.
      name: 'e2e-setup',
      testDir: './tests/e2e',
      testMatch: /global\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: env.stackAppUrl, launchOptions: chromiumLaunch },
    },
    {
      name: 'e2e-stack',
      testDir: './tests/e2e',
      testMatch: /.*\.e2e\.ts/,
      dependencies: ['e2e-setup'],
      // Real services, real Kafka: allow for eventual consistency, but never retry — a retried
      // journey would book a second appointment and hide the first failure.
      timeout: 120_000,
      retries: 0,
      // The gateway rate-limits each IP (100 req/min, 5 logins/min), so journeys run one at a time.
      fullyParallel: false,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        baseURL: env.stackAppUrl,
        storageState: env.adminStorageState,
        launchOptions: chromiumLaunch,
        actionTimeout: 15_000,
      },
    },
  ],

  webServer: [
    {
      // UI layer: the production bundle (what Azure Static Web Apps serves), built with a gateway
      // URL that only the test doubles answer, then served by `vite preview`. Testing the built
      // bundle rather than the dev server is both closer to production and much faster per page.
      command:
        'npx vite build --outDir ui-tests/.app-under-test --emptyOutDir --logLevel warn && ' +
        `npx vite preview --outDir ui-tests/.app-under-test --port ${env.mockAppPort} --strictPort`,
      cwd: '..',
      url: env.mockAppUrl,
      reuseExistingServer: !isCI,
      timeout: 120_000,
      env: { VITE_API_BASE_URL: env.mockGatewayUrl },
    },
    // E2E layer: the app, pointed at the real gateway. Port 5173 on purpose — it is the origin
    // the gateway's CORS policy allows. Not started when E2E_APP_URL names a deployed frontend.
    ...(env.externalAppUrl
      ? []
      : [
          {
            command: `npm run dev -- --port ${env.stackAppPort} --strictPort`,
            cwd: '..',
            url: env.stackAppUrl,
            reuseExistingServer: true,
            timeout: 120_000,
            env: { VITE_API_BASE_URL: env.gatewayUrl },
          },
        ]),
  ],
});
