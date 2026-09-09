import apiClient from './client';

export interface Department {
  id: string | number;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const departmentsApi = {
  list: (): Promise<Department[]> =>
    apiClient.get<Department[]>('/api/departments').then((r) =>
      Array.isArray(r.data) ? r.data : []
    ),
};
