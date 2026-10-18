import type { PatientDetails } from '../pages/booking.page';

/**
 * A brand-new patient for every E2E run.
 *
 * The NIC and email are unique-indexed in the Patient service, so a fixed patient would register
 * once and 409 on every run after. Deriving them from the clock keeps reruns green without anyone
 * cleaning the database between them, and the "E2E" surname makes test data easy to find and purge.
 */
export function uniquePatient(): PatientDetails & { tag: string } {
  const stamp = String(Date.now()).slice(-10); // 10 digits
  const tag = stamp.slice(-6);
  return {
    tag,
    nic: `19${stamp}`, // 12 digits: the new-format NIC
    dateOfBirth: '1994-08-17',
    firstName: 'Playwright',
    lastName: `E2E${tag}`,
    gender: 'Female',
    phone: `077${stamp.slice(-7)}`,
    email: `e2e.${stamp}@medicore.test`,
    addressLine1: '1 Test Lane, Malabe',
    district: 'Colombo',
  };
}
