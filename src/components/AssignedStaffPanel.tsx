import React, { useEffect, useState } from 'react';
import { staffApi, type StaffResponse } from '../api/staff';

interface AssignedStaffPanelProps {
  /** Pass exactly one: the department whose staff to list, or the specialization to match. */
  departmentId?: string | number;
  specialization?: string;
  /** What is being drilled into, for the empty-state wording. */
  label: string;
}

/**
 * The staff assigned to one department or holding one specialization.
 *
 * Mounted only while its row is expanded, so the fetch is lazy by construction — no caching or
 * "has this been loaded" bookkeeping in the parent.
 */
export const AssignedStaffPanel: React.FC<AssignedStaffPanelProps> = ({
  departmentId,
  specialization,
  label,
}) => {
  const [staff, setStaff] = useState<StaffResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await staffApi.list({
          departmentId,
          specialization,
          isActive: true,
          pageSize: 100,
        });
        if (cancelled) return;
        setStaff(result.items ?? []);
      } catch {
        if (!cancelled) setError('Could not load the staff for this entry.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [departmentId, specialization]);

  if (isLoading) {
    return <p className="assigned-staff-empty">Loading staff…</p>;
  }

  if (error) {
    return (
      <p className="assigned-staff-empty assigned-staff-empty--error" role="alert">
        {error}
      </p>
    );
  }

  if (staff.length === 0) {
    return <p className="assigned-staff-empty">No active staff assigned to {label}.</p>;
  }

  return (
    <table className="assigned-staff-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Role</th>
          <th>Email</th>
          {departmentId !== undefined && <th>Specialization</th>}
        </tr>
      </thead>
      <tbody>
        {staff.map((member) => (
          <tr key={String(member.id)}>
            <td className="font-semibold">
              {member.fullName || `${member.firstName} ${member.lastName}`}
            </td>
            <td>
              <span className="badge">{member.role || '—'}</span>
            </td>
            <td className="text-muted">{member.email || '—'}</td>
            {departmentId !== undefined && (
              <td className="text-muted">{member.specialization || '—'}</td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default AssignedStaffPanel;
