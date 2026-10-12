import { describe, expect, it } from 'vitest';
import {
  GENERAL_CONSULTATION,
  SPECIALIST_CONSULTATION,
  serviceCodeForDoctor,
  serviceCodeForSpecialization,
} from './serviceCodes';

// These cases are the appointment service's own (AppointmentModelTests): the two implementations
// have to produce the same code for the same name, or a tariff never matches its bookings.
describe('serviceCodeForSpecialization', () => {
  it.each([
    ['Cardiology', 'SPEC-CARDIOLOGY'],
    ['  cardiology ', 'SPEC-CARDIOLOGY'],
    ['Ear, Nose & Throat', 'SPEC-EAR-NOSE-THROAT'],
    ['General Medicine', 'SPEC-GENERAL-MEDICINE'],
  ])('gives %j its own code', (specialization, expected) => {
    expect(serviceCodeForSpecialization(specialization)).toBe(expected);
  });

  it('falls back to the default specialist code when the name has nothing usable in it', () => {
    expect(serviceCodeForSpecialization('???')).toBe(SPECIALIST_CONSULTATION);
  });

  it('cuts a long name to the service-code column', () => {
    const code = serviceCodeForSpecialization('a'.repeat(100));

    expect(code).toBe(`SPEC-${'A'.repeat(45)}`);
    expect(code).toHaveLength(50);
  });

  it('does not leave a separator dangling when the cut lands on one', () => {
    expect(serviceCodeForSpecialization(`${'a'.repeat(44)} and more`)).toBe(`SPEC-${'A'.repeat(44)}`);
  });
});

describe('serviceCodeForDoctor', () => {
  it.each([[''], ['   '], [null], [undefined]])(
    'is a general consultation for a doctor with no specialization (%j)',
    (specialization) => {
      expect(serviceCodeForDoctor(specialization)).toBe(GENERAL_CONSULTATION);
    },
  );

  it("is the specialization's own code for a specialist", () => {
    expect(serviceCodeForDoctor('Neurology')).toBe('SPEC-NEUROLOGY');
  });
});
