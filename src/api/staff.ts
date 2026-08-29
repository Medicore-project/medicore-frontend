import apiClient from './client';

export interface StaffResponse {
  id: string | number;
  userId?: string | number;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string;
  specialization?: string;
  departmentId?: string | number;
  hireDate?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface StaffListResponse {
  items: StaffResponse[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface StaffListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  departmentId?: string | number;
  role?: string;
  isActive?: boolean;
}

export interface CreateStaffBody {
  email: string;
  password: string;
  role: string;
  firstName: string;
  lastName: string;
  phone?: string;
  specialization?: string;
  departmentId?: string | number;
}

export interface UpdateStaffBody {
  firstName: string;
  lastName: string;
  phone?: string;
  specialization?: string;
  departmentId?: string | number;
  isActive?: boolean;
}

export const staffApi = {
  list: (params: StaffListParams = {}): Promise<StaffListResponse> => {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.pageSize !== undefined) query.set('pageSize', String(params.pageSize));
    if (params.search) query.set('search', params.search);
    if (params.departmentId !== undefined) query.set('departmentId', String(params.departmentId));
    if (params.role) query.set('role', params.role);
    if (params.isActive !== undefined) query.set('isActive', String(params.isActive));
    return apiClient.get<StaffListResponse>(`/api/staff?${query.toString()}`).then((r) => r.data);
  },

  getById: (id: string | number): Promise<StaffResponse> =>
    apiClient.get<StaffResponse>(`/api/staff/${id}`).then((r) => r.data),

  create: (body: CreateStaffBody): Promise<StaffResponse> =>
    apiClient.post<StaffResponse>('/api/staff', body).then((r) => r.data),

  update: (id: string | number, body: UpdateStaffBody): Promise<StaffResponse> =>
    apiClient.put<StaffResponse>(`/api/staff/${id}`, body).then((r) => r.data),

  remove: (id: string | number): Promise<void> =>
    apiClient.delete(`/api/staff/${id}`).then(() => undefined),
};
