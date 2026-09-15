export function canWritePrescriptions(role?: string): boolean {
  return role === 'Doctor' || role === 'Nurse';
}
