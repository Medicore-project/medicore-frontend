import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';

export interface Specialization {
  id: string | number;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const SpecializationsPage: React.FC = () => {
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
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

  const fetchSpecializations = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/api/specializations');
      setSpecializations(Array.isArray(response.data) ? response.data : []);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Failed to fetch specializations.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSpecializations();
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
        return 'A specialization with this name already exists.';
      }
      if (axiosErr.response?.status === 400) {
        return 'Cannot delete: Specialization is currently assigned to active staff.';
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
      await apiClient.post('/api/specializations', {
        name: newName.trim(),
        description: newDescription.trim(),
      });
      setSuccessMessage('Specialization created successfully.');
      setNewName('');
      setNewDescription('');
      setIsAdding(false);
      await fetchSpecializations();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Failed to create specialization.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (spec: Specialization) => {
    setEditingId(spec.id);
    setEditName(spec.name);
    setEditDescription(spec.description || '');
    setEditIsActive(spec.isActive);
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
      await apiClient.put(`/api/specializations/${id}`, {
        name: editName.trim(),
        description: editDescription.trim(),
        isActive: editIsActive,
      });
      setSuccessMessage('Specialization updated successfully.');
      setEditingId(null);
      await fetchSpecializations();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Failed to update specialization.'));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async (id: string | number) => {
    if (!window.confirm('Are you sure you want to delete this specialization?')) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setDeletingId(id);

    try {
      await apiClient.delete(`/api/specializations/${id}`);
      setSuccessMessage('Specialization deleted successfully.');
      await fetchSpecializations();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Failed to delete specialization.'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="management-page">
      <div className="page-header">
        <div>
          <h1>Specializations</h1>
          <p className="page-subtitle">Manage medical specializations and domains</p>
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
            + Add Specialization
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
            <h3>New Specialization</h3>
          </div>
          <form onSubmit={handleCreate} className="inline-form">
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="spec-name">Specialization Name *</label>
                <input
                  id="spec-name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Pediatric Cardiology"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="spec-desc">Description</label>
                <input
                  id="spec-desc"
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Specialization details or notes"
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
                {isSubmitting ? 'Saving...' : 'Save Specialization'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card table-card">
        {isLoading ? (
          <div className="table-loading">
            <div className="spinner" />
            <p>Loading specializations...</p>
          </div>
        ) : specializations.length === 0 ? (
          <div className="table-empty">
            <p>No specializations found. Click &quot;Add Specialization&quot; to create one.</p>
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
                {specializations.map((spec) => {
                  const isEditing = editingId === spec.id;

                  if (isEditing) {
                    return (
                      <tr key={spec.id} className="editing-row">
                        <td>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="input-inline"
                            placeholder="Specialization name"
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
                              onClick={() => handleSaveEdit(spec.id)}
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
                    <tr key={spec.id}>
                      <td className="font-semibold">{spec.name}</td>
                      <td className="text-muted">{spec.description || '—'}</td>
                      <td>
                        <span
                          className={`badge ${spec.isActive ? 'badge-success' : 'badge-inactive'}`}
                        >
                          {spec.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-buttons">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => startEdit(spec)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger-outline"
                            onClick={() => handleDelete(spec.id)}
                            disabled={deletingId === spec.id}
                          >
                            {deletingId === spec.id ? 'Deleting...' : 'Delete'}
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

export default SpecializationsPage;
