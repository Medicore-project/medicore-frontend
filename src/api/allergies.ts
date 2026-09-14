import apiClient from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AllergyStatus = 'Active' | 'Inactive';
export type AllergySeverity = 'Mild' | 'Moderate' | 'Severe' | 'Unknown';

export interface AllergyResponse {
  allergyId: string;
  patientId: string;
  allergen: string;
  severity: AllergySeverity;
  reaction?: string | null;
  status: AllergyStatus;
  recordedAtUtc: string;
  notes?: string | null;
  recordedByClinicianId: string;
  recordedByClinicianEmail: string;
  recordedByClinicianRole: string;
}

export interface AllergyConflictResponse {
  hasConflict: boolean;
  matchedAllergy?: AllergyResponse | null;
}

export interface CreateAllergyBody {
  allergen: string;
  severity: AllergySeverity;
  reaction?: string | null;
  notes?: string | null;
}

export interface UpdateAllergyBody {
  allergen: string;
  severity: AllergySeverity;
  reaction?: string | null;
  notes?: string | null;
}

// ── API client ────────────────────────────────────────────────────────────────

const allergiesPath = (patientId: string) =>
  `/patient/api/patients/${patientId}/allergies`;

export const allergyApi = {
  /** Returns all allergy records (active + inactive) for a patient. */
  async list(patientId: string): Promise<AllergyResponse[]> {
    const response = await apiClient.get<AllergyResponse[]>(allergiesPath(patientId));
    return response.data;
  },

  /** Returns a single allergy by its stable business key. */
  async getById(patientId: string, allergyId: string): Promise<AllergyResponse> {
    const response = await apiClient.get<AllergyResponse>(
      `${allergiesPath(patientId)}/${allergyId}`,
    );
    return response.data;
  },

  /**
   * Checks whether a drug name conflicts with an active allergy.
   * Always returns 200 — inspect hasConflict to determine whether to warn.
   */
  async checkConflict(patientId: string, drug: string): Promise<AllergyConflictResponse> {
    const response = await apiClient.get<AllergyConflictResponse>(
      `${allergiesPath(patientId)}/check`,
      { params: { drug } },
    );
    return response.data;
  },

  /** Records a new active allergy. */
  async create(patientId: string, body: CreateAllergyBody): Promise<AllergyResponse> {
    const response = await apiClient.post<AllergyResponse>(allergiesPath(patientId), body);
    return response.data;
  },

  /** Updates mutable fields of an existing allergy. */
  async update(
    patientId: string,
    allergyId: string,
    body: UpdateAllergyBody,
  ): Promise<AllergyResponse> {
    const response = await apiClient.put<AllergyResponse>(
      `${allergiesPath(patientId)}/${allergyId}`,
      body,
    );
    return response.data;
  },

  /** Transitions an active allergy to Inactive (excludes it from conflict checks). */
  async deactivate(patientId: string, allergyId: string): Promise<AllergyResponse> {
    const response = await apiClient.patch<AllergyResponse>(
      `${allergiesPath(patientId)}/${allergyId}/deactivate`,
    );
    return response.data;
  },

  /** Soft-deletes an allergy record. */
  async remove(patientId: string, allergyId: string): Promise<void> {
    await apiClient.delete(`${allergiesPath(patientId)}/${allergyId}`);
  },
};
