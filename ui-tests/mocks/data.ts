import { addDays, addMinutes, colomboToUtc, colomboToday } from '../support/dates';

/**
 * Test data builders for the UI layer. Shapes mirror the gateway's real DTOs
 * (src/api/*.ts in the frontend, *Dtos.cs in the backend), so a contract drift shows up as a
 * failing UI test rather than a surprise in the demo.
 *
 * Dates are always relative to "today in Colombo", so the data never goes stale.
 */

export type Role = 'Admin' | 'Receptionist' | 'Doctor' | 'Nurse' | 'Patient';

export interface StaffUser {
  id: string;
  email: string;
  role: Role;
  name: string;
  staffId: string | null;
  password: string;
}

export const USERS: Record<Role, StaffUser> = {
  Admin: { id: 'u-admin', email: 'admin@medicore.local', role: 'Admin', name: 'Asha Admin', staffId: 's-admin', password: 'Admin@123' },
  Receptionist: { id: 'u-rec', email: 'reception@medicore.local', role: 'Receptionist', name: 'Kasun Wijesinghe', staffId: 's-rec', password: 'Demo@123' },
  Doctor: { id: 'u-doc', email: 'amara.perera@medicore.local', role: 'Doctor', name: 'Dr Amara Perera', staffId: 'doc-amara', password: 'Demo@123' },
  Nurse: { id: 'u-nurse', email: 'maya.jayasinghe@medicore.local', role: 'Nurse', name: 'Maya Jayasinghe', staffId: 's-nurse', password: 'Demo@123' },
  Patient: { id: 'u-pat', email: 'dinesh@example.test', role: 'Patient', name: 'Dinesh Bandara', staffId: null, password: 'Demo@123' },
};

export function authResponse(user: StaffUser) {
  return {
    accessToken: `staff-token-${user.role.toLowerCase()}`,
    refreshToken: `refresh-${user.role.toLowerCase()}`,
    user: { id: user.id, email: user.email, role: user.role, name: user.name, staffId: user.staffId },
  };
}

// ── Doctors and slots ─────────────────────────────────────────────────────────

export interface PublicDoctor {
  doctorId: string;
  fullName: string;
  specialization: string;
}

export const DOCTORS: PublicDoctor[] = [
  { doctorId: 'doc-amara', fullName: 'Dr Amara Perera', specialization: 'General Practice' },
  { doctorId: 'doc-nimal', fullName: 'Dr Nimal Fernando', specialization: 'Cardiology' },
];

export interface PublicSlot {
  slotId: string;
  startUtc: string;
  endUtc: string;
  slotDate: string;
  durationMinutes: number;
}

/** Free 30-minute slots for a doctor, two and three days from now (always outside the 24 h cancel window). */
export function slotsFor(doctorId: string, today = colomboToday()): PublicSlot[] {
  const days = [addDays(today, 2), addDays(today, 3)];
  const times = ['09:00', '09:30', '10:00'];
  return days.flatMap((date) =>
    times.map((time) => {
      const startUtc = colomboToUtc(date, time);
      return {
        slotId: `${doctorId}-${date}-${time.replace(':', '')}`,
        startUtc,
        endUtc: addMinutes(startUtc, 30),
        slotDate: date,
        durationMinutes: 30,
      };
    }),
  );
}

// ── Patients ──────────────────────────────────────────────────────────────────

export interface KnownPatient {
  patientId: string;
  patientNumber: string;
  dateOfBirth: string;
  fullName: string;
  nic: string;
}

export const RETURNING_PATIENT: KnownPatient = {
  patientId: 'pat-dinesh',
  patientNumber: 'PAT-000101',
  dateOfBirth: '1990-05-14',
  fullName: 'Dinesh Bandara',
  nic: '199012345678',
};

export function bookingIdentity(patient: Pick<KnownPatient, 'patientId' | 'patientNumber' | 'fullName'>) {
  return {
    patientId: patient.patientId,
    patientNumber: patient.patientNumber,
    fullName: patient.fullName,
    bookingToken: `booking-token-${patient.patientNumber}`,
    // Twenty minutes, as the patient service issues it.
    expiresAtUtc: new Date(Date.now() + 20 * 60_000).toISOString(),
  };
}

/** A valid registration form for a first-time patient; override any field to make it invalid. */
export function newPatientForm(overrides: Partial<Record<string, string>> = {}) {
  return {
    nic: '200045678901',
    dateOfBirth: '2000-02-29',
    firstName: 'Nethmi',
    lastName: 'Rajapaksha',
    gender: 'Female',
    phone: '0771234567',
    email: 'nethmi.r@example.test',
    addressLine1: '12 Kandy Road',
    district: 'Colombo',
    ...overrides,
  };
}

/** The code the UI derives from a specialization (mirrors src/utils/serviceCodes.ts). */
export function serviceCodeFor(specialization: string): string {
  const slug = specialization.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase();
  return slug ? `SPEC-${slug}` : 'GEN-CONSULT';
}

export function appointmentFor(slot: PublicSlot, doctor: PublicDoctor, patient: { patientId: string; patientNumber: string; fullName: string }) {
  return {
    appointmentId: `appt-${slot.slotId}`,
    patientId: patient.patientId,
    patientNumber: patient.patientNumber,
    patientName: patient.fullName,
    doctorId: doctor.doctorId,
    doctorName: doctor.fullName,
    specialization: doctor.specialization,
    slotId: slot.slotId,
    startUtc: slot.startUtc,
    endUtc: slot.endUtc,
    slotDate: slot.slotDate,
    durationMinutes: slot.durationMinutes,
    serviceCode: serviceCodeFor(doctor.specialization),
    status: 'Booked',
    createdAt: new Date().toISOString(),
  };
}
