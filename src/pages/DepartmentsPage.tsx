import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';

export interface Department {
  id: string | number;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const DepartmentsPage: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  const fetchDepartments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/api/departments');
      setDepartments(Array.isArray(response.data) ? response.data : []);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Failed to fetch departments.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const extractErrorMessage = (err: unknown, fallback: string): string => {
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as {
        response?: {
          status?: number;
          data?: {
            message?: string;
            error?: string;
          };
        };
      };
      if (axiosErr.response?.data?.message) {
        return axiosErr.response.data.message;
      }
      if (axiosErr.response?.data?.error) {
        return axiosErr.response.data.error;
      }
      if (axiosErr.response?.status === 409) {
        return 'A department with this name already exists.';
      }
      if (axiosErr.response?.status === 400) {
        return 'Cannot delete: Department is currently assigned to active staff.';
      }
    }
    if (err instanceof Error) {
      return err.message;
    }
    return fallback;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      await apiClient.post('/api/departments', {
        name: newName.trim(),
        description: newDescription.trim(),
      });
      setSuccessMessage('Department created successfully.');
      setNewName('');
      setNewDescription('');
      setIsAdding(false);
      await fetchDepartments();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Failed to create department.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (dept: Department) => {
    setEditingId(dept.id);
    setEditName(dept.name);
    setEditDescription(dept.description || '');
    setEditIsActive(dept.isActive);
    setError(null);
    setSuccessMessage(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDescription('');
    setEditIsActive(true);
  };

  const handleSaveEdit = async (id: string | number) => {
    if (!editName.trim()) return;

    setError(null);
    setSuccessMessage(null);
    setIsSavingEdit(true);

    try {
      await apiClient.put(`/api/departments/${id}`, {
        name: editName.trim(),
        description: editDescription.trim(),
        isActive: editIsActive,
      });
      setSuccessMessage('Department updated successfully.');
      setEditingId(null);
      await fetchDepartments();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Failed to update department.'));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async (id: string | number) => {
    if (!window.confirm('Are you sure you want to delete this department?')) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setDeletingId(id);

    try {
      await apiClient.delete(`/api/departments/${id}`);
      setSuccessMessage('Department deleted successfully.');
      await fetchDepartments();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Failed to delete department.'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="management-page">
      <div className="page-header">
        <div>
          <h1>Departments</h1>
          <p className="page-subtitle">Manage hospital departments and units</p>
        </div>
        {!isAdding && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setIsAdding(true);
              setError(null);
              setSuccessMessage(null);
            }}
          >
            + Add Department
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          <span>{error}</span>
          <button type="button" className="alert-close" onClick={() => setError(null)}>
            ×
          </button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success" role="alert">
          <span>{successMessage}</span>
          <button
            type="button"
            className="alert-close"
            onClick={() => setSuccessMessage(null)}
          >
            ×
          </button>
        </div>
      )}

      {isAdding && (
        <div className="card add-form-card">
          <div className="card-header">
            <h3>New Department</h3>
          </div>
          <form onSubmit={handleCreate} className="inline-form">
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="dept-name">Department Name *</label>
                <input
                  id="dept-name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Cardiology"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="dept-desc">Description</label>
                <input
                  id="dept-desc"
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Department details or notes"
                />
              </div>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsAdding(false);
                  setNewName('');
                  setNewDescription('');
                }}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting || !newName.trim()}
              >
                {isSubmitting ? 'Saving...' : 'Save Department'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card table-card">
        {isLoading ? (
          <div className="table-loading">
            <div className="spinner" />
            <p>Loading departments...</p>
          </div>
        ) : departments.length === 0 ? (
          <div className="table-empty">
            <p>No departments found. Click &quot;Add Department&quot; to create one.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Name</th>
                  <th style={{ width: '40%' }}>Description</th>
                  <th style={{ width: '15%' }}>Status</th>
                  <th style={{ width: '20%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => {
                  const isEditing = editingId === dept.id;

                  if (isEditing) {
                    return (
                      <tr key={dept.id} className="editing-row">
                        <td>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="input-inline"
                            placeholder="Department name"
                            required
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className="input-inline"
                            placeholder="Description"
                          />
                        </td>
                        <td>
                          <label className="toggle-label">
                            <input
                              type="checkbox"
                              checked={editIsActive}
                              onChange={(e) => setEditIsActive(e.target.checked)}
                            />
                            <span>{editIsActive ? 'Active' : 'Inactive'}</span>
                          </label>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="action-buttons">
                            <button
                              type="button"
                              className="btn btn-sm btn-success"
                              onClick={() => handleSaveEdit(dept.id)}
                              disabled={isSavingEdit || !editName.trim()}
                            >
                              {isSavingEdit ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={cancelEdit}
                              disabled={isSavingEdit}
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={dept.id}>
                      <td className="font-semibold">{dept.name}</td>
                      <td className="text-muted">{dept.description || '—'}</td>
                      <td>
                        <span
                          className={`badge ${dept.isActive ? 'badge-success' : 'badge-inactive'}`}
                        >
                          {dept.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-buttons">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => startEdit(dept)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger-outline"
                            onClick={() => handleDelete(dept.id)}
                            disabled={deletingId === dept.id}
                          >
                            {deletingId === dept.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DepartmentsPage;
