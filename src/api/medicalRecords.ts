import apiClient from './client';

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

export interface MedicalRecordMetadata {
  recordId: string;
  versionId: string;
  patientId: string;
  visitReference: string;
  authorClinicianId: string;
  authorClinicianEmail: string;
  authorClinicianRole: 'Doctor' | 'Nurse' | 'System';
  authoredAtUtc: string;
  version: number;
}

export interface MedicalRecordSummary extends MedicalRecordMetadata {
  clinicalNotesPreview: string;
  conditionCount: number;
}

export interface MedicalRecordResponse extends MedicalRecordMetadata {
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

export interface MedicalRecordListParams {
  page?: number;
  pageSize?: number;
}

const recordsPath = (patientId: string) => `/patient/api/patients/${patientId}/records`;

export const medicalRecordApi = {
  async list(patientId: string, params: MedicalRecordListParams = {}): Promise<PagedMedicalRecordResponse> {
    const response = await apiClient.get<PagedMedicalRecordResponse>(recordsPath(patientId), { params });
    return response.data;
  },

  async getById(patientId: string, recordId: string): Promise<MedicalRecordResponse> {
    const response = await apiClient.get<MedicalRecordResponse>(`${recordsPath(patientId)}/${recordId}`);
    return response.data;
  },

  async getVersions(patientId: string, recordId: string): Promise<MedicalRecordResponse[]> {
    const response = await apiClient.get<MedicalRecordResponse[]>(
      `${recordsPath(patientId)}/${recordId}/versions`,
    );
    return response.data;
  },

  async create(patientId: string, body: CreateMedicalRecordBody): Promise<MedicalRecordResponse> {
    const response = await apiClient.post<MedicalRecordResponse>(recordsPath(patientId), body);
    return response.data;
  },

  async update(
    patientId: string,
    recordId: string,
    body: UpdateMedicalRecordBody,
  ): Promise<MedicalRecordResponse> {
    const response = await apiClient.put<MedicalRecordResponse>(
      `${recordsPath(patientId)}/${recordId}`,
      body,
    );
    return response.data;
  },

  async remove(patientId: string, recordId: string): Promise<void> {
    await apiClient.delete(`${recordsPath(patientId)}/${recordId}`);
  },
};
