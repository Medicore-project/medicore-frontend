export const PATIENT_READER_ROLES = ['Admin', 'Receptionist', 'Doctor', 'Nurse'] as const;
export const FRONT_DESK_ROLES = ['Admin', 'Receptionist'] as const;

/** Mirrors the appointment service's ScheduleReader policy. */
export const SCHEDULE_READER_ROLES = ['Admin', 'Receptionist', 'Doctor', 'Nurse'] as const;

/**
 * Mirrors the appointment service's LeaveReader policy — the full leave record (every request
 * whatever its status, reasons, review notes), not just which dates are covered by approved leave.
 * Narrower than SCHEDULE_READER_ROLES on purpose: Receptionist and Nurse get "is this doctor
 * unavailable" from the booking grid (SCHEDULE_READER_ROLES already covers that), and have no
 * reason to browse the approval history behind it.
 */
export const LEAVE_READER_ROLES = ['Admin', 'Doctor'] as const;

export function canWriteMedicalRecords(role?: string): boolean {
  return role === 'Doctor' || role === 'Nurse';
}

export function canManagePatientProfiles(role?: string): boolean {
  return role === 'Admin' || role === 'Receptionist';
}

/**
 * Whether departments and specializations can be created, edited or deleted, as opposed to merely
 * read. Mirrors the identity service's AdminOnly policy on those controllers' write endpoints —
 * Receptionist reaches every GET (FRONT_DESK_ROLES) but no write, so the pages render read-only
 * for them rather than offering buttons the API would reject.
 */
export function canManageOrganization(role?: string): boolean {
  return role === 'Admin';
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

/**
 * Every role that works in the clinic. Excludes Patient, the only non-staff role — a patient has
 * no business on the dashboard, the patient directory or the schedule grid.
 */
export const CLINIC_ROLES = ['Admin', 'Receptionist', 'Doctor', 'Nurse'] as const;

/**
 * Who reaches the in-app booking page.
 *
 * Mirrors the appointment service's BookingCreator policy on its role half (Admin, Receptionist),
 * plus Patient so a logged-in patient reaches booking and nothing else. Note that the Patient role
 * grants no API permission of its own: a patient books with a booking token from
 * /api/patients/identify, exactly as an anonymous visitor does, because BookingCreator's role
 * branch is front-desk only. This constant controls navigation, not authority.
 */
export const BOOKING_ROLES = ['Admin', 'Receptionist', 'Patient'] as const;

/**
 * Where a signed-in user belongs. Staff land on the dashboard; a Patient reaches booking and
 * nothing else, so sending them to the staff-only dashboard would only bounce them back to `/`.
 */
export function homePathFor(role?: string): string {
  return role === 'Patient' ? '/appointments/book' : '/dashboard';
}
