import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { staffApi, type StaffResponse } from '../api/staff';

function formatDate(val?: string): string {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function extractApiError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const ae = err as { response?: { data?: { message?: string; error?: string } } };
    if (ae.response?.data?.message) return ae.response.data.message;
    if (ae.response?.data?.error) return ae.response.data.error;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value }) => (
  <div className="detail-row">
    <span className="detail-label">{label}</span>
    <span className="detail-value">{value}</span>
  </div>
);

export const StaffDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [staff, setStaff] = useState<StaffResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    staffApi
      .getById(id)
      .then(setStaff)
      .catch((err: unknown) => {
        setError(extractApiError(err, 'Failed to load staff member.'));
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return (
      <div className="management-page">
        <div className="table-loading">
          <div className="spinner" />
          <p>Loading staff member…</p>
        </div>
      </div>
    );
  }

  if (error || !staff) {
    return (
      <div className="management-page">
        <div className="alert alert-danger" role="alert">
          <span>{error ?? 'Staff member not found.'}</span>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ marginTop: 12 }}
          onClick={() => navigate('/staff')}
        >
          ← Back to Staff
        </button>
      </div>
    );
  }

  return (
    <div className="management-page">
      <div className="page-header">
        <div>
          <h1>{staff.fullName}</h1>
          <p className="page-subtitle">{staff.role}</p>
        </div>
        <div className="action-buttons">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/staff')}
          >
            ← Back
          </button>
        </div>
      </div>

      <div className="detail-card">
        <div className="detail-section-title">Personal Information</div>
        <DetailRow label="Full Name" value={staff.fullName} />
        <DetailRow label="First Name" value={staff.firstName} />
        <DetailRow label="Last Name" value={staff.lastName} />
        <DetailRow label="Email" value={staff.email} />
        <DetailRow label="Phone" value={staff.phone ?? '—'} />
      </div>

      <div className="detail-card">
        <div className="detail-section-title">Employment Details</div>
        <DetailRow label="Role" value={staff.role} />
        <DetailRow label="Specialization" value={staff.specialization ?? '—'} />
        <DetailRow label="Department ID" value={staff.departmentId ?? '—'} />
        <DetailRow
          label="Hire Date"
          value={formatDate(staff.hireDate)}
        />
        <DetailRow
          label="Status"
          value={
            <span className={`badge ${staff.isActive ? 'badge-success' : 'badge-inactive'}`}>
              {staff.isActive ? 'Active' : 'Inactive'}
            </span>
          }
        />
      </div>

      <div className="detail-card">
        <div className="detail-section-title">System Information</div>
        <DetailRow label="Staff ID" value={String(staff.id)} />
        <DetailRow label="User ID" value={staff.userId !== undefined ? String(staff.userId) : '—'} />
        <DetailRow label="Created" value={formatDate(staff.createdAt)} />
        <DetailRow label="Last Updated" value={formatDate(staff.updatedAt)} />
      </div>
    </div>
  );
};

export default StaffDetailPage;
