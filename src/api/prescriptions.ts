import apiClient from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PrescriptionStatus = 'Active' | 'Completed';

export interface PrescriptionResponse {
  prescriptionId: string;
  patientId: string;
  medicalRecordId?: string | null;
  drug: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  status: PrescriptionStatus;
  prescriberClinicianId: string;
  prescriberClinicianEmail: string;
  prescriberClinicianRole: string;
  prescribedAtUtc: string;
  completedAtUtc?: string | null;
  notes?: string | null;
}

export interface PrescriptionListResponse {
  active: PrescriptionResponse[];
  history: PrescriptionResponse[];
}

export interface CreatePrescriptionBody {
  drug: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  medicalRecordId?: string | null;
  notes?: string | null;
  /** Set to true to bypass the allergy conflict guard after clinician confirmation. */
  overrideConflict?: boolean;
}

export interface UpdatePrescriptionBody {
  drug: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  notes?: string | null;
}

// ── API client ────────────────────────────────────────────────────────────────

const prescriptionsPath = (patientId: string) =>
  `/patient/api/patients/${patientId}/prescriptions`;

export const prescriptionApi = {
  /** Returns active + history lists for a patient. */
  async list(patientId: string): Promise<PrescriptionListResponse> {
    const response = await apiClient.get<PrescriptionListResponse>(
      prescriptionsPath(patientId),
    );
    return response.data;
  },

  /** Returns a single prescription by its stable business key. */
  async getById(patientId: string, prescriptionId: string): Promise<PrescriptionResponse> {
    const response = await apiClient.get<PrescriptionResponse>(
      `${prescriptionsPath(patientId)}/${prescriptionId}`,
    );
    return response.data;
  },

  /** Creates a new active prescription. */
  async create(patientId: string, body: CreatePrescriptionBody): Promise<PrescriptionResponse> {
    const response = await apiClient.post<PrescriptionResponse>(
      prescriptionsPath(patientId),
      body,
    );
    return response.data;
  },

  /** Updates the mutable fields of an active prescription. */
  async update(
    patientId: string,
    prescriptionId: string,
    body: UpdatePrescriptionBody,
  ): Promise<PrescriptionResponse> {
    const response = await apiClient.put<PrescriptionResponse>(
      `${prescriptionsPath(patientId)}/${prescriptionId}`,
      body,
    );
    return response.data;
  },

  /** Marks an active prescription as completed (moves it to history). */
  async complete(patientId: string, prescriptionId: string): Promise<PrescriptionResponse> {
    const response = await apiClient.patch<PrescriptionResponse>(
      `${prescriptionsPath(patientId)}/${prescriptionId}/complete`,
    );
    return response.data;
  },

  /** Soft-deletes a prescription. */
  async remove(patientId: string, prescriptionId: string): Promise<void> {
    await apiClient.delete(`${prescriptionsPath(patientId)}/${prescriptionId}`);
  },
};
