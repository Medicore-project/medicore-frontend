import apiClient from './client';

export interface Specialization {
  id: string | number;
  name: string;
  description?: string;
  isActive: boolean;
}

export const specializationsApi = {
  list: (): Promise<Specialization[]> =>
    apiClient.get<Specialization[]>('/api/specializations').then((r) =>
      Array.isArray(r.data) ? r.data : []
    ),
};
