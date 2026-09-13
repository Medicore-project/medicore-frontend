export type ConditionClinicalStatus = 'Active' | 'Resolved' | 'Historical';

export interface ConditionInput {
  name: string;
  code?: string;
  clinicalStatus: ConditionClinicalStatus;
  notes?: string;
}

export interface ConditionResponse extends ConditionInput {
  conditionId: string;
}

export interface CreateMedicalRecordBody {
  visitReference: string;
  clinicalNotes: string;
  conditions: ConditionInput[];
}

export interface UpdateMedicalRecordBody {
  expectedVersion: number;
  clinicalNotes: string;
  conditions: ConditionInput[];
}

export interface MedicalRecordSummary {
  recordId: string;
  versionId: string;
  patientId: string;
  visitReference: string;
  authorClinicianId: string;
  authorClinicianEmail: string;
  authorClinicianRole: 'Doctor' | 'Nurse';
  authoredAtUtc: string;
  version: number;
}

export interface MedicalRecordResponse extends MedicalRecordSummary {
  clinicalNotes: string;
  previousVersionId?: string | null;
  isCurrent: boolean;
  conditions: ConditionResponse[];
}

export interface PagedMedicalRecordResponse {
  items: MedicalRecordSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}
