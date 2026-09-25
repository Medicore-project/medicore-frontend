/**
 * Everything the suite needs to know about the environment it is pointed at.
 *
 * All of it is overridable, because the booking flow is exercised against a running stack rather
 * than a fixture: the clinic's data changes, and a hard-coded patient number would rot in a week.
 */

export const config = {
  /**
   * Where the app is served. Note the app must reach the API through the **gateway** — CORS is
   * configured only there, so a dev server pointed straight at :5002 or :5003 fails a preflight
   * before any of this runs.
   */
  baseUrl: process.env.E2E_BASE_URL ?? 'http://localhost:5173',

  /**
   * A patient who already exists, for the returning-patient spec. Both are required: the number
   * alone identifies nobody, by design.
   */
  existingPatient: {
    patientNumber: process.env.E2E_PATIENT_NUMBER ?? '',
    dateOfBirth: process.env.E2E_PATIENT_DOB ?? '',
  },

  /** Set HEADLESS=1 to run without a visible browser. */
  headless: process.env.HEADLESS === '1',

  /** How long to wait for an element before failing. Slots come from a real database. */
  waitTimeout: Number(process.env.E2E_WAIT_TIMEOUT ?? 15000),
};

export function requireExistingPatient() {
  const { patientNumber, dateOfBirth } = config.existingPatient;

  if (!patientNumber || !dateOfBirth) {
    throw new Error(
      'Set E2E_PATIENT_NUMBER and E2E_PATIENT_DOB to a patient that exists in the database. ' +
        'See e2e/README.md — the returning-patient spec cannot invent one, because identifying ' +
        'requires a real number and its matching date of birth.',
    );
  }

  return config.existingPatient;
}
