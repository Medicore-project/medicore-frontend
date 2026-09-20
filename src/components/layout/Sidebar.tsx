import React from 'react';
import { NavLink } from 'react-router-dom';

// `end` pins the active state to an exact match. Without it a parent path stays
// highlighted while a child route is open — /appointments would light up on
// /appointments/leave.
const navItems: Array<{ name: string; path: string; end?: boolean }> = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Departments', path: '/departments' },
  { name: 'Specializations', path: '/specializations' },
  { name: 'Staff', path: '/staff' },
  { name: 'Patients', path: '/patients' },
  { name: 'Appointments', path: '/appointments', end: true },
  { name: 'Doctor Leave', path: '/appointments/leave' },
  { name: 'Billing', path: '/billing' },
  { name: 'Audit Reports', path: '/reports/audit' },
  { name: 'Demographics Report', path: '/reports/demographics' },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h2>MediCore</h2>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
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
