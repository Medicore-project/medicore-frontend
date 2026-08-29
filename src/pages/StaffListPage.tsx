import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { staffApi, type StaffResponse, type StaffListParams } from '../api/staff';
import StaffFormModal from './StaffFormModal';

const ROLES = ['Admin', 'Doctor', 'Nurse', 'Receptionist', 'Patient'];
const PAGE_SIZE = 10;

function extractApiError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const ae = err as { response?: { data?: { message?: string; error?: string } } };
    if (ae.response?.data?.message) return ae.response.data.message;
    if (ae.response?.data?.error) return ae.response.data.error;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

export const StaffListPage: React.FC = () => {
  const navigate = useNavigate();

  const [items, setItems] = useState<StaffResponse[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<'' | 'true' | 'false'>('');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingStaff, setEditingStaff] = useState<StaffResponse | null>(null);

  const [deactivatingId, setDeactivatingId] = useState<string | number | null>(null);

  const fetchStaff = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const params: StaffListParams = { page, pageSize: PAGE_SIZE };
    if (search.trim()) params.search = search.trim();
    if (roleFilter) params.role = roleFilter;
    if (activeFilter !== '') params.isActive = activeFilter === 'true';
    try {
      const data = await staffApi.list(params);
      setItems(data.items);
      setTotalCount(data.totalCount);
      setTotalPages(data.totalPages);
      setHasPreviousPage(data.hasPreviousPage);
      setHasNextPage(data.hasNextPage);
    } catch (err: unknown) {
      setError(extractApiError(err, 'Failed to fetch staff.'));
    } finally {
      setIsLoading(false);
    }
  }, [page, search, roleFilter, activeFilter]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setPage(1);
    }
  };

  const handleDeactivate = async (staff: StaffResponse) => {
    if (!window.confirm(`Deactivate ${staff.fullName}?`)) return;
    setError(null);
    setSuccessMessage(null);
    setDeactivatingId(staff.id);
    try {
      await staffApi.update(staff.id, {
        firstName: staff.firstName,
        lastName: staff.lastName,
        phone: staff.phone,
        specialization: staff.specialization,
        departmentId: staff.departmentId,
        isActive: false,
      });
      setSuccessMessage(`${staff.fullName} has been deactivated.`);
      fetchStaff();
    } catch (err: unknown) {
      setError(extractApiError(err, 'Failed to deactivate staff member.'));
    } finally {
      setDeactivatingId(null);
    }
  };

  const openCreate = () => {
    setEditingStaff(null);
    setModalMode('create');
    setError(null);
    setSuccessMessage(null);
  };

  const openEdit = (staff: StaffResponse) => {
    setEditingStaff(staff);
    setModalMode('edit');
    setError(null);
    setSuccessMessage(null);
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingStaff(null);
  };

  const onModalSuccess = () => {
    setSuccessMessage(modalMode === 'create' ? 'Staff member added successfully.' : 'Staff member updated.');
    fetchStaff();
  };

  return (
    <div className="management-page">
      <div className="page-header">
        <div>
          <h1>Staff Management</h1>
          <p className="page-subtitle">
            {totalCount} staff member{totalCount !== 1 ? 's' : ''} total
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          + Add Staff
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          <span>{error}</span>
          <button type="button" className="alert-close" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success" role="alert">
          <span>{successMessage}</span>
          <button type="button" className="alert-close" onClick={() => setSuccessMessage(null)}>×</button>
        </div>
      )}

      <div className="card filter-bar">
        <input
          type="search"
          className="filter-search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          onKeyDown={handleSearchKeyDown}
        />
        <select
          className="filter-select"
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          className="filter-select"
          value={activeFilter}
          onChange={(e) => { setActiveFilter(e.target.value as '' | 'true' | 'false'); setPage(1); }}
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      <div className="card table-card">
        {isLoading ? (
          <div className="table-loading">
            <div className="spinner" />
            <p>Loading staff…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="table-empty">
            <p>No staff members found.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Specialization</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id}>
                    <td className="font-semibold">{s.fullName}</td>
                    <td className="text-muted">{s.email}</td>
                    <td>{s.role}</td>
                    <td className="text-muted">{s.departmentId ?? '—'}</td>
                    <td className="text-muted">{s.specialization ?? '—'}</td>
                    <td>
                      <span className={`badge ${s.isActive ? 'badge-success' : 'badge-inactive'}`}>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="action-buttons">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => navigate(`/staff/${s.id}`)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => openEdit(s)}
                        >
                          Edit
                        </button>
                        {s.isActive && (
                          <button
                            type="button"
                            className="btn btn-sm btn-danger-outline"
                            onClick={() => handleDeactivate(s)}
                            disabled={deactivatingId === s.id}
                          >
                            {deactivatingId === s.id ? 'Working…' : 'Deactivate'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination-bar">
          <span className="pagination-info">
            Page {page} of {totalPages}
          </span>
          <div className="action-buttons">
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={!hasPreviousPage}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Previous
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={!hasNextPage}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {modalMode === 'create' && (
        <StaffFormModal
          mode="create"
          onSuccess={onModalSuccess}
          onClose={closeModal}
        />
      )}

      {modalMode === 'edit' && editingStaff && (
        <StaffFormModal
          mode="edit"
          staff={editingStaff}
          onSuccess={onModalSuccess}
          onClose={closeModal}
        />
      )}
    </div>
  );
};

export default StaffListPage;
