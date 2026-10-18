import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Every setting the suite reads, in one place, each overridable from the environment.
 * See `.env.example` for what they mean.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

// Settings may live in ui-tests/.env (git-ignored) instead of the shell — handy on Windows.
// Variables already set in the environment win over the file.
const envFile = path.join(root, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const number = (value: string | undefined, fallback: number) =>
  value && !Number.isNaN(Number(value)) ? Number(value) : fallback;

const mockAppPort = number(process.env.UI_MOCK_PORT, 5199);
const stackAppPort = number(process.env.E2E_APP_PORT, 5173);

export const env = {
  // ── UI layer (test doubles) ──
  mockAppPort,
  mockAppUrl: `http://localhost:${mockAppPort}`,
  /** A gateway nobody runs. Only the test doubles answer it. */
  mockGatewayUrl: 'http://mock-gateway.medicore.test',

  // ── E2E layer (real stack) ──
  stackAppPort,
  /**
   * Set E2E_APP_URL to run the journeys against an already-deployed frontend instead of starting
   * one (e.g. a staging Static Web App); otherwise a dev server on :5173 is started.
   */
  externalAppUrl: process.env.E2E_APP_URL,
  stackAppUrl: process.env.E2E_APP_URL ?? `http://localhost:${stackAppPort}`,
  gatewayUrl: process.env.E2E_GATEWAY_URL ?? 'http://localhost:5000',
  adminEmail: process.env.E2E_ADMIN_EMAIL ?? 'admin@medicore.local',
  adminPassword: process.env.E2E_ADMIN_PASSWORD ?? '',
  /** May setup create a doctor schedule when nobody is bookable? Always locally; opt-in when E2E_APP_URL is set. */
  allowProvisioning: process.env.E2E_ALLOW_PROVISIONING === '1',

  /** How long to wait for Kafka-driven state (doctor cache, draft invoice, void) to arrive. */
  eventualTimeoutMs: number(process.env.E2E_EVENTUAL_TIMEOUT_MS, 45_000),

  /** Signed-in admin browser state, written by the e2e setup project. */
  adminStorageState: path.join(root, '.auth', 'admin.json'),
  /** What setup learned about the stack (the doctor it provisioned), for the specs. */
  stackContextFile: path.join(root, '.auth', 'stack-context.json'),

  chromiumPath: process.env.PW_CHROMIUM_PATH,
} as const;
