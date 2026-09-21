import { describe, expect, it } from 'vitest';
import {
  LEAVE_READER_ROLES,
  SCHEDULE_READER_ROLES,
  canApproveLeave,
  canRequestLeave,
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
