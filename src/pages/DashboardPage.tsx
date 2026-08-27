import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>Welcome back, {user?.name || user?.email || 'User'}</p>
      </div>
      <div className="dashboard-cards">
        <div className="dashboard-card">
          <h3>Staff</h3>
          <p className="card-value">Active</p>
        </div>
        <div className="dashboard-card">
          <h3>Patients</h3>
          <p className="card-value">Overview</p>
        </div>
        <div className="dashboard-card">
          <h3>Appointments</h3>
          <p className="card-value">Schedule</p>
        </div>
        <div className="dashboard-card">
          <h3>Billing</h3>
          <p className="card-value">Invoices</p>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
