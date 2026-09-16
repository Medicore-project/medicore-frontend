import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <span className="dashboard-eyebrow">MEDICORE WORKSPACE</span>
        <h1>Welcome back, {user?.name || user?.email || 'User'}</h1>
        <p>Here is a quick view of your clinical operations for today.</p>
      </div>
      <div className="dashboard-cards">
        <div className="dashboard-card dashboard-card--staff">
          <div className="dashboard-card-top">
            <span className="dashboard-card-icon" aria-hidden="true">✦</span>
            <span className="dashboard-card-status">Team</span>
          </div>
          <h3>Staff</h3>
          <p className="card-value">Active</p>
          <span className="dashboard-card-note">Manage your care team</span>
        </div>
        <div className="dashboard-card dashboard-card--patients">
          <div className="dashboard-card-top">
            <span className="dashboard-card-icon" aria-hidden="true">♥</span>
            <span className="dashboard-card-status">Care</span>
          </div>
          <h3>Patients</h3>
          <p className="card-value">Overview</p>
          <span className="dashboard-card-note">Find and manage records</span>
        </div>
        <div className="dashboard-card dashboard-card--appointments">
          <div className="dashboard-card-top">
            <span className="dashboard-card-icon" aria-hidden="true">◷</span>
            <span className="dashboard-card-status">Today</span>
          </div>
          <h3>Appointments</h3>
          <p className="card-value">Schedule</p>
          <span className="dashboard-card-note">Keep every visit on track</span>
        </div>
        <div className="dashboard-card dashboard-card--billing">
          <div className="dashboard-card-top">
            <span className="dashboard-card-icon" aria-hidden="true">⌁</span>
            <span className="dashboard-card-status">Finance</span>
          </div>
          <h3>Billing</h3>
          <p className="card-value">Invoices</p>
          <span className="dashboard-card-note">Review billing activity</span>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
