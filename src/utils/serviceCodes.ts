/**
 * The billable service a booking represents — the key billing looks a tariff up by.
 *
 * Mirrors the appointment service's `ServiceCodes`: a doctor with no specialization is a general
 * consultation, and a doctor with one carries that specialization's own code. Two places here
 * depend on agreeing with it exactly — the booking page, which shows the code before the server
 * has resolved it, and the tariff form, which creates the tariff those bookings are priced by.
 * Change the rule there and it must change here, or new tariffs stop matching bookings.
 */

/** A consultation with a doctor who has no specialization. */
export const GENERAL_CONSULTATION = 'GEN-CONSULT';

/** The default specialist tariff: what a specialization is billed at until it has its own. */
export const SPECIALIST_CONSULTATION = 'SPEC-CONSULT';

const SPECIALIZATION_PREFIX = 'SPEC-';

/** The width of the service-code columns in the appointment and billing services. */
const MAX_LENGTH = 50;

/**
 * The code for one specialization: its name upper-cased, with every run of anything other than an
 * ASCII letter or digit collapsed to a single hyphen. "Ear, Nose & Throat" is
 * `SPEC-EAR-NOSE-THROAT`. A name with nothing usable in it is the default specialist code.
 */
export function serviceCodeForSpecialization(specialization: string): string {
  // Non-ASCII characters are dropped before upper-casing, so the result cannot depend on how a
  // locale upper-cases them — the server applies the same rule and must land on the same code.
  const slug = specialization
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-/, '')
    .slice(0, MAX_LENGTH - SPECIALIZATION_PREFIX.length)
    .replace(/-$/, '')
    .toUpperCase();

  return slug ? SPECIALIZATION_PREFIX + slug : SPECIALIST_CONSULTATION;
}

/** The code a booking with this doctor will carry, given the doctor's specialization. */
export function serviceCodeForDoctor(specialization: string | null | undefined): string {
  return specialization?.trim()
    ? serviceCodeForSpecialization(specialization)
    : GENERAL_CONSULTATION;
}
