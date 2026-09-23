import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  BOOKING_ROLES,
  CLINIC_ROLES,
  FRONT_DESK_ROLES,
  LEAVE_READER_ROLES,
  PATIENT_READER_ROLES,
  SCHEDULE_READER_ROLES,
} from '../../utils/permissions';

// `end` pins the active state to an exact match. Without it a parent path stays
// highlighted while a child route is open — /appointments would light up on
// /appointments/leave.
//
// `allowedRoles` mirrors the exact role sets `App.tsx` gates each route behind (undefined = any
// authenticated user, matching a route with no `allowedRoles` on ProtectedRoute). Keeping the
// sidebar in lockstep with the routes means a user is never shown a tab that would just bounce
// them back to `/` — see ProtectedRoute, which does that redirect on a role mismatch.
const navItems: Array<{
  name: string;
  path: string;
  end?: boolean;
  allowedRoles?: readonly string[];
}> = [
  { name: 'Dashboard', path: '/dashboard', allowedRoles: CLINIC_ROLES },
  { name: 'Departments', path: '/departments', allowedRoles: FRONT_DESK_ROLES },
  { name: 'Specializations', path: '/specializations', allowedRoles: FRONT_DESK_ROLES },
  { name: 'Staff', path: '/staff', allowedRoles: ['Admin'] },
  { name: 'Patients', path: '/patients', allowedRoles: PATIENT_READER_ROLES },
  { name: 'Appointments', path: '/appointments', end: true, allowedRoles: SCHEDULE_READER_ROLES },
  { name: 'Book Appointment', path: '/appointments/book', allowedRoles: BOOKING_ROLES },
  { name: 'Doctor Leave', path: '/appointments/leave', allowedRoles: LEAVE_READER_ROLES },
  { name: 'Audit Reports', path: '/reports/audit', allowedRoles: ['Admin'] },
  { name: 'Demographics Report', path: '/reports/demographics', allowedRoles: ['Admin'] },
];

export const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const visibleItems = navItems.filter(
    (item) => !item.allowedRoles || (!!user && item.allowedRoles.includes(user.role)),
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h2>MediCore</h2>
      </div>
      <nav className="sidebar-nav">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={({ isActive }) =>
              isActive ? 'sidebar-link active' : 'sidebar-link'
            }
          >
            {item.name}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
