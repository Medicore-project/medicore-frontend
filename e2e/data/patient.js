/**
 * A new patient, different on every run.
 *
 * The NIC is unique-indexed, so a fixed one would register on the first run and 409 on every run
 * after it. Deriving it from the clock keeps reruns green without anyone cleaning the database
 * between them.
 */
export function buildNewPatient() {
  // A 12-digit NIC: a plausible birth year, then ten digits from the clock.
  const unique = String(Date.now()).slice(-10);
  const nic = `19${unique}`;

  return {
    nic,
    firstName: 'E2E',
    lastName: `Patient${unique.slice(-4)}`,
    dateOfBirth: '1995-04-02',
    gender: 'Female',
    email: `e2e.${unique}@medicore.test`,
    phone: '0771234567',
    addressLine1: '1 Galle Road',
    district: 'Colombo',
  };
}
