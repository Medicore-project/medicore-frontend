export const PATIENT_READER_ROLES = ['Admin', 'Receptionist', 'Doctor', 'Nurse'] as const;
export const FRONT_DESK_ROLES = ['Admin', 'Receptionist'] as const;

export function canWriteMedicalRecords(role?: string): boolean {
  return role === 'Doctor' || role === 'Nurse';
}

export function canManagePatientProfiles(role?: string): boolean {
  return role === 'Admin' || role === 'Receptionist';
}
