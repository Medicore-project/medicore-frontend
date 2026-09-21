export const PATIENT_READER_ROLES = ['Admin', 'Receptionist', 'Doctor', 'Nurse'] as const;
export const FRONT_DESK_ROLES = ['Admin', 'Receptionist'] as const;

/** Mirrors the appointment service's ScheduleReader policy. */
export const SCHEDULE_READER_ROLES = ['Admin', 'Receptionist', 'Doctor', 'Nurse'] as const;

export function canWriteMedicalRecords(role?: string): boolean {
  return role === 'Doctor' || role === 'Nurse';
}

export function canManagePatientProfiles(role?: string): boolean {
  return role === 'Admin' || role === 'Receptionist';
}

/**
 * Mirrors the appointment service's ScheduleManager policy — create, change and delete doctor
 * schedules and block slots. This only hides controls; the service enforces it for real.
 */
export function canManageSchedules(role?: string): boolean {
  return role === 'Admin' || role === 'Receptionist';
}

/**
 * Mirrors the appointment service's LeaveManager policy — submit and withdraw leave requests.
 * Doctor-only: the service additionally checks the caller's own staffId against the request's
 * DoctorId, so this only ever lets someone act on their own leave, never on another doctor's
 * behalf. Submitting does not grant leave: the request stays pending until an approver decides it.
 */
export function canRequestLeave(role?: string): boolean {
  return role === 'Doctor';
}

/**
 * Mirrors the appointment service's LeaveApprover policy. Deliberately excludes Doctor, so a
 * doctor never sees the controls to approve their own leave request.
 */
export function canApproveLeave(role?: string): boolean {
  return role === 'Admin';
}
