import { describe, expect, it } from 'vitest';
import {
  BOOKED_LIST_ROLES,
  BOOKING_ROLES,
  CLINIC_ROLES,
  FRONT_DESK_ROLES,
  LEAVE_READER_ROLES,
  PATIENT_READER_ROLES,
  SCHEDULE_READER_ROLES,
  canApproveLeave,
  canChangeAppointments,
  canCompleteAppointment,
  canManageOrganization,
  canManagePatientProfiles,
  canManageSchedules,
  canRequestLeave,
  canWriteMedicalRecords,
  homePathFor,
} from './permissions';

const ALL_ROLES = ['Admin', 'Receptionist', 'Doctor', 'Nurse'] as const;

describe('canRequestLeave', () => {
  it('allows only doctors, so nobody files leave on a doctor behalf', () => {
    expect(canRequestLeave('Doctor')).toBe(true);
    expect(canRequestLeave('Admin')).toBe(false);
    expect(canRequestLeave('Receptionist')).toBe(false);
    expect(canRequestLeave('Nurse')).toBe(false);
  });

  it('denies a missing role rather than defaulting open', () => {
    expect(canRequestLeave(undefined)).toBe(false);
    expect(canRequestLeave('')).toBe(false);
  });
});

describe('canApproveLeave', () => {
  it('allows only admin', () => {
    expect(canApproveLeave('Admin')).toBe(true);
    expect(canApproveLeave('Doctor')).toBe(false);
    expect(canApproveLeave('Receptionist')).toBe(false);
    expect(canApproveLeave('Nurse')).toBe(false);
  });

  it('never lets the requester approve their own leave', () => {
    // Requesting and granting are separate permissions on purpose.
    const canDoBoth = ALL_ROLES.filter((role) => canRequestLeave(role) && canApproveLeave(role));

    expect(canDoBoth).toEqual([]);
  });
});

describe('leave role sets mirror the appointment service policies', () => {
  it('limits the full leave record to admin and doctors', () => {
    expect([...LEAVE_READER_ROLES].sort()).toEqual(['Admin', 'Doctor']);
  });

  it('keeps approved-leave dates readable by the whole clinic', () => {
    // The booking grid labels a doctor's empty days for the front desk, so narrowing this
    // would take the "on leave" explanation away from Receptionist and Nurse.
    expect([...SCHEDULE_READER_ROLES].sort()).toEqual([
      'Admin',
      'Doctor',
      'Nurse',
      'Receptionist',
    ]);
  });

  it('is narrower than the schedule reader set', () => {
    const leaveReaders = new Set<string>(LEAVE_READER_ROLES);
    const excluded = SCHEDULE_READER_ROLES.filter((role) => !leaveReaders.has(role));

    expect(excluded.sort()).toEqual(['Nurse', 'Receptionist']);
  });
});

describe('the Patient role (SCRUM-34)', () => {
  it('reaches booking, and only booking', () => {
    expect([...BOOKING_ROLES].sort()).toEqual(['Admin', 'Patient', 'Receptionist']);
  });

  it('appears in no other role set', () => {
    // The whole of the "gate only" decision, asserted rather than assumed. A patient signs in to
    // book; everything else in the app is clinic staff's.
    const otherSets = {
      PATIENT_READER_ROLES,
      FRONT_DESK_ROLES,
      SCHEDULE_READER_ROLES,
      LEAVE_READER_ROLES,
      CLINIC_ROLES,
      BOOKED_LIST_ROLES,
    };

    Object.entries(otherSets).forEach(([name, roles]) => {
      expect([name, (roles as readonly string[]).includes('Patient')]).toEqual([name, false]);
    });
  });

  it('is granted no capability by any permission helper', () => {
    expect(canWriteMedicalRecords('Patient')).toBe(false);
    expect(canManagePatientProfiles('Patient')).toBe(false);
    expect(canManageOrganization('Patient')).toBe(false);
    expect(canManageSchedules('Patient')).toBe(false);
    expect(canRequestLeave('Patient')).toBe(false);
    expect(canApproveLeave('Patient')).toBe(false);
  });

  it('is not one of the clinic roles', () => {
    expect([...CLINIC_ROLES].sort()).toEqual(['Admin', 'Doctor', 'Nurse', 'Receptionist']);
  });
});

describe('homePathFor', () => {
  it('sends a patient to booking, the only page their role reaches', () => {
    // The dashboard is CLINIC_ROLES only; sending a patient there would bounce them straight to /.
    expect(homePathFor('Patient')).toBe('/appointments/book');
    expect(BOOKING_ROLES).toContain('Patient');
  });

  it('sends every clinic role to the dashboard', () => {
    CLINIC_ROLES.forEach((role) => expect(homePathFor(role)).toBe('/dashboard'));
  });
});

describe('BOOKED_LIST_ROLES', () => {
  it('is the front desk plus doctors, who need to see who is booked with them', () => {
    expect([...BOOKED_LIST_ROLES].sort()).toEqual(['Admin', 'Doctor', 'Receptionist']);
  });
});

describe('canChangeAppointments (SCRUM-36)', () => {
  it('allows the front desk to cancel and reschedule, as ScheduleManager does', () => {
    expect(ALL_ROLES.filter((role) => canChangeAppointments(role))).toEqual(['Admin', 'Receptionist']);
    expect(canChangeAppointments('Patient')).toBe(false);
    expect(canChangeAppointments(undefined)).toBe(false);
  });
});

describe('canCompleteAppointment (SCRUM-36)', () => {
  it("allows only the appointment's own doctor", () => {
    expect(canCompleteAppointment({ role: 'Doctor', staffId: 'doctor-1' }, 'doctor-1')).toBe(true);
    expect(canCompleteAppointment({ role: 'Doctor', staffId: 'doctor-2' }, 'doctor-1')).toBe(false);
  });

  it('never matches on a role alone, or on a missing staff id', () => {
    expect(canCompleteAppointment({ role: 'Admin', staffId: 'doctor-1' }, 'doctor-1')).toBe(false);
    expect(canCompleteAppointment({ role: 'Nurse', staffId: 'doctor-1' }, 'doctor-1')).toBe(false);
    expect(canCompleteAppointment({ role: 'Doctor', staffId: null }, 'doctor-1')).toBe(false);
    expect(canCompleteAppointment({ role: 'Doctor', staffId: '' }, '')).toBe(false);
    expect(canCompleteAppointment(null, 'doctor-1')).toBe(false);
  });
});
