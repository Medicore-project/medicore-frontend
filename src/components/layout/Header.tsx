import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="header">
      <div className="header-title">Hospital Management System</div>
      <div className="header-user">
        <div className="user-info">
          <span className="user-name">{user?.name || user?.email || 'User'}</span>
          <span className="user-role">{user?.role || 'Staff'}</span>
        </div>
        <button type="button" onClick={logout} className="logout-button">
          Logout
        </button>
      </div>
    </header>
  );
};

export default Header;
