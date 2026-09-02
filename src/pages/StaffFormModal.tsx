import React, { useState, useEffect, type FormEvent } from 'react';
import { staffApi, type CreateStaffBody, type UpdateStaffBody, type StaffResponse } from '../api/staff';
import apiClient from '../api/client';

const ROLES = ['Admin', 'Doctor', 'Nurse', 'Receptionist', 'Patient'];

function extractApiError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const ae = err as { response?: { status?: number; data?: { message?: string; error?: string } } };
    if (ae.response?.data?.message) return ae.response.data.message;
    if (ae.response?.data?.error) return ae.response.data.error;
    if (ae.response?.status === 409) return 'A staff member with this email already exists.';
    if (ae.response?.status === 400) return 'Validation failed. Please check all required fields.';
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

interface CreateProps {
  mode: 'create';
  onSuccess: () => void;
  onClose: () => void;
}

interface EditProps {
  mode: 'edit';
  staff: StaffResponse;
  onSuccess: () => void;
  onClose: () => void;
}

type StaffFormModalProps = CreateProps | EditProps;

export const StaffFormModal: React.FC<StaffFormModalProps> = (props) => {
  const isEdit = props.mode === 'edit';
  const existing = isEdit ? props.staff : null;

  const [firstName, setFirstName] = useState(existing?.firstName ?? '');
  const [lastName, setLastName] = useState(existing?.lastName ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(existing?.role ?? ROLES[0]);
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [specialization, setSpecialization] = useState(existing?.specialization ?? '');
  const [departmentId, setDepartmentId] = useState(
    existing?.departmentId !== undefined ? String(existing.departmentId) : ''
  );
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);

  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [specializations, setSpecializations] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [deptRes, specRes] = await Promise.all([
          apiClient.get('/api/departments'),
          apiClient.get('/api/specializations')
        ]);
        setDepartments(deptRes.data);
        setSpecializations(specRes.data);
      } catch (err) {
        console.error('Failed to load options', err);
      }
    };
    fetchData();
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = 'First name is required.';
    if (!lastName.trim()) errs.lastName = 'Last name is required.';
    if (!isEdit) {
      if (!email.trim()) errs.email = 'Email is required.';
      if (!password.trim()) errs.password = 'Password is required.';
    }
    if (!departmentId.trim()) errs.departmentId = 'Department is required.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setError(null);
    setIsSubmitting(true);

    try {
      if (isEdit && existing) {
        const body: UpdateStaffBody = {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || undefined,
          specialization: specialization.trim() || undefined,
          departmentId: departmentId.trim() || undefined,
          isActive,
        };
        await staffApi.update(existing.id, body);
      } else {
        const body: CreateStaffBody = {
          email: email.trim(),
          password: password.trim(),
          role,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || undefined,
          specialization: specialization.trim() || undefined,
          departmentId: departmentId.trim() || undefined,
        };
        await staffApi.create(body);
      }
      props.onSuccess();
      props.onClose();
    } catch (err: unknown) {
      setError(extractApiError(err, `Failed to ${isEdit ? 'update' : 'create'} staff member.`));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Staff Member' : 'Add New Staff Member'}</h2>
          <button type="button" className="modal-close" onClick={props.onClose}>×</button>
        </div>

        {error && (
          <div className="alert alert-danger" role="alert" style={{ margin: '0 0 16px' }}>
            <span>{error}</span>
            <button type="button" className="alert-close" onClick={() => setError(null)}>×</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="sf-firstname">First Name *</label>
              <input
                id="sf-firstname"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
              />
              {fieldErrors.firstName && <span className="field-error">{fieldErrors.firstName}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="sf-lastname">Last Name *</label>
              <input
                id="sf-lastname"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
              />
              {fieldErrors.lastName && <span className="field-error">{fieldErrors.lastName}</span>}
            </div>
          </div>

          {!isEdit && (
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="sf-email">Email *</label>
                <input
                  id="sf-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@hospital.com"
                />
                {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="sf-password">Password *</label>
                <input
                  id="sf-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                />
                {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
              </div>
            </div>
          )}

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="sf-role">Role</label>
              <select
                id="sf-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={isEdit}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="sf-phone">Phone</label>
              <input
                id="sf-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 000 0000"
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="sf-spec">Specialization</label>
              <select
                id="sf-spec"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
              >
                <option value="">-- Select Specialization --</option>
                {specializations.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="sf-dept">Department *</label>
              <select
                id="sf-dept"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">-- Select Department --</option>
                {departments.map((d) => (
                  <option key={d.id} value={String(d.id)}>{d.name}</option>
                ))}
              </select>
              {fieldErrors.departmentId && <span className="field-error">{fieldErrors.departmentId}</span>}
            </div>
          </div>

          {isEdit && (
            <div className="form-group">
              <label className="toggle-label" htmlFor="sf-active">
                <input
                  id="sf-active"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span>Active</span>
              </label>
            </div>
          )}

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={props.onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Staff Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StaffFormModal;
