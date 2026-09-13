import axios from 'axios';
import apiClient from './client';

export interface CreatePatientBody {
  nic: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  district: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export interface PatientRegistrationResponse extends CreatePatientBody {
  patientId: string;
  patientNumber: string;
  fullName: string;
  createdAt: string;
}

export interface PatientProfileResponse extends CreatePatientBody {
  patientId: string;
  patientNumber: string;
  fullName: string;
  createdAt: string;
  updatedAt?: string | null;
}

export type UpdatePatientBody = Omit<CreatePatientBody, 'nic'>;

export interface ExistingPatientSummary {
  patientId: string;
  patientNumber: string;
  fullName: string;
  email: string;
  isArchived: boolean;
}

export interface DuplicatePatientResponse {
  message: string;
  existingPatient: ExistingPatientSummary;
}

export interface ValidationProblemResponse {
  title?: string;
  errors?: Record<string, string[]>;
}

export const patientApi = {
  register: (body: CreatePatientBody): Promise<PatientRegistrationResponse> =>
    apiClient
      .post<PatientRegistrationResponse>('/patient/api/patients', body)
      .then((response) => response.data),

  getById: (patientId: string): Promise<PatientProfileResponse> =>
    apiClient
      .get<PatientProfileResponse>(`/patient/api/patients/${patientId}`)
      .then((response) => response.data),

  update: (patientId: string, body: UpdatePatientBody): Promise<PatientProfileResponse> =>
    apiClient
      .put<PatientProfileResponse>(`/patient/api/patients/${patientId}`, body)
      .then((response) => response.data),

  remove: (patientId: string): Promise<void> =>
    apiClient.delete(`/patient/api/patients/${patientId}`).then(() => undefined),
};

export function isDuplicatePatientError(error: unknown): boolean {
  return axios.isAxiosError<DuplicatePatientResponse>(error) && error.response?.status === 409;
}

export function isValidationProblem(error: unknown): boolean {
  return axios.isAxiosError<ValidationProblemResponse>(error) && error.response?.status === 400;
}
