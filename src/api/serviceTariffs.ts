import apiClient from './client';

export interface ServiceTariff {
  tariffId: string;
  serviceCode: string;
  description: string;
  unitPrice: number;
  currency: string;
  effectiveFromUtc: string;
  effectiveToUtc: string | null;
  isActive: boolean;
}

export interface CreateServiceTariffRequest {
  serviceCode: string;
  description: string;
  unitPrice: number;
  currency: string;
  effectiveFromUtc: string;
}

export type UpdateServiceTariffRequest = Omit<CreateServiceTariffRequest, 'serviceCode'>;

const path = '/billing/api/service-tariffs';

export const serviceTariffApi = {
  async list(includeInactive = true): Promise<ServiceTariff[]> {
    const response = await apiClient.get<ServiceTariff[]>(path, { params: { includeInactive } });
    return Array.isArray(response.data) ? response.data : [];
  },

  async create(request: CreateServiceTariffRequest): Promise<ServiceTariff> {
    const response = await apiClient.post<ServiceTariff>(path, request);
    return response.data;
  },

  async updatePrice(tariffId: string, request: UpdateServiceTariffRequest): Promise<ServiceTariff> {
    const response = await apiClient.put<ServiceTariff>(`${path}/${tariffId}`, request);
    return response.data;
  },

  async deactivate(tariffId: string): Promise<void> {
    await apiClient.delete(`${path}/${tariffId}`);
  },
};
