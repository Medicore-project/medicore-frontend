import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ChevronLeftIcon, PlusIcon } from '../icons/LineIcons';
import { visibleSections } from './navigation';

type SidebarProps = {
  /** Desktop: icons only. Labels stay in the DOM (visually hidden) so links keep their names. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Phone: the drawer is open. */
  mobileOpen?: boolean;
  onNavigate?: () => void;
};

/**
 * The staff workspace's navigation: pages grouped by area, each gated by the same roles as its
 * route (see navigation.ts), so nobody is offered a page that would bounce them.
 */
export const Sidebar: React.FC<SidebarProps> = ({
  collapsed = false,
  onToggleCollapsed,
  mobileOpen = false,
  onNavigate,
}) => {
  const { user } = useAuth();
  const sections = visibleSections(user?.role);

  return (
    <aside
      className={`ws-sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-open' : ''}`}
      aria-label="Workspace navigation"
    >
      <div className="ws-sidebar-brand">
        <span className="ws-brand-tile" aria-hidden="true">
          <PlusIcon className="ws-brand-plus" />
        </span>
        <span className="ws-brand-text">
          <strong>MediCore</strong>
          <span>Staff workspace</span>
        </span>
      </div>

      <nav className="ws-sidebar-nav">
        {sections.map((section) => (
          <div key={section.title} className="ws-nav-section">
            <span className="ws-nav-heading">{section.title}</span>
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  onClick={onNavigate}
                  data-tooltip={item.name}
                  className={({ isActive }) => `ws-nav-link ${isActive ? 'active' : ''}`}
                >
                  <span className="ws-nav-icon" aria-hidden="true">
                    <Icon className="ws-icon" />
                  </span>
                  <span className="ws-nav-label">{item.name}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {onToggleCollapsed && (
        <div className="ws-sidebar-footer">
          <button
            type="button"
            className="ws-collapse-btn"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeftIcon className="ws-icon" />
            <span className="ws-nav-label">Collapse</span>
          </button>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
