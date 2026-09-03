import apiClient from './client';

export interface RoleResponse {
  id: string | number;
  name: string;
  description?: string;
}

export const rolesApi = {
  list: (): Promise<RoleResponse[]> =>
    apiClient.get<RoleResponse[]>('/api/roles').then((r) => r.data),
};
