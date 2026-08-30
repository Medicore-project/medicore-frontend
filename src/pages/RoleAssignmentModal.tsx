import React, { useState, useEffect, type FormEvent } from 'react';
import { staffApi, type StaffResponse } from '../api/staff';
import { rolesApi, type RoleResponse } from '../api/roles';

interface RoleAssignmentModalProps {
  staff: StaffResponse;
  onSuccess: () => void;
  onClose: () => void;
}

export const RoleAssignmentModal: React.FC<RoleAssignmentModalProps> = ({ staff, onSuccess, onClose }) => {
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | number>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    rolesApi.list()
      .then(setRoles)
      .catch(() => setError('Failed to load roles.'))
      .finally(() => setIsLoading(false));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedRoleId) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      await staffApi.assignRole(staff.id, selectedRoleId);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to assign role.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Assign Role for {staff.fullName}</h2>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>

        {error && (
          <div className="alert alert-danger" role="alert" style={{ margin: '16px 24px 0' }}>
            <span>{error}</span>
            <button type="button" className="alert-close" onClick={() => setError(null)}>×</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="role-select">Role *</label>
            <select
              id="role-select"
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              disabled={isLoading || isSubmitting}
              required
            >
              <option value="">Select a role...</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading || isSubmitting || !selectedRoleId}>
              {isSubmitting ? 'Assigning...' : 'Assign Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RoleAssignmentModal;
