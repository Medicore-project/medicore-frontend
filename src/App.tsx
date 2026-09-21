import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DepartmentsPage from './pages/DepartmentsPage';
import SpecializationsPage from './pages/SpecializationsPage';
import StaffListPage from './pages/StaffListPage';
import StaffDetailPage from './pages/StaffDetailPage';
import AuditReportPage from './pages/AuditReportPage';
import DemographicsReportPage from './pages/DemographicsReportPage';
import PatientRegistrationPage from './pages/PatientRegistrationPage';
import PatientProfilePage from './pages/PatientProfilePage';
import PatientSearchPage from './pages/PatientSearchPage';
import PatientMedicalRecordsPage from './pages/PatientMedicalRecordsPage';
import MedicalRecordDetailPage from './pages/MedicalRecordDetailPage';
import PatientPrescriptionsPage from './pages/PatientPrescriptionsPage';
import PatientAllergiesPage from './pages/PatientAllergiesPage';
import AppointmentsPage from './pages/AppointmentsPage';
import DoctorLeavePage from './pages/DoctorLeavePage';
import ProtectedRoute from './routes/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import LandingPage from './pages/LandingPage';
import {
  FRONT_DESK_ROLES,
  LEAVE_READER_ROLES,
  PATIENT_READER_ROLES,
  SCHEDULE_READER_ROLES,
} from './utils/permissions';

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/patients/:patientId/records" element={<PatientMedicalRecordsPage />} />
          <Route path="/patients/:patientId/records/:recordId" element={<MedicalRecordDetailPage />} />
          <Route path="/patients/:patientId/prescriptions" element={<PatientPrescriptionsPage />} />
          <Route path="/patients/:patientId/allergies" element={<PatientAllergiesPage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['Admin']} />}>
        <Route element={<AppLayout />}>
          <Route path="/departments" element={<DepartmentsPage />} />
          <Route path="/specializations" element={<SpecializationsPage />} />
          <Route path="/staff" element={<StaffListPage />} />
          <Route path="/staff/:id" element={<StaffDetailPage />} />
          <Route path="/reports/audit" element={<AuditReportPage />} />
          <Route path="/reports/demographics" element={<DemographicsReportPage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={[...PATIENT_READER_ROLES]} />}>
        <Route element={<AppLayout />}>
          <Route path="/patients" element={<PatientSearchPage />} />
          <Route path="/patients/:id" element={<PatientProfilePage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={[...FRONT_DESK_ROLES]} />}>
        <Route element={<AppLayout />}>
          <Route path="/patients/register" element={<PatientRegistrationPage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={[...SCHEDULE_READER_ROLES]} />}>
        <Route element={<AppLayout />}>
          <Route path="/appointments" element={<AppointmentsPage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={[...LEAVE_READER_ROLES]} />}>
        <Route element={<AppLayout />}>
          <Route path="/appointments/leave" element={<DoctorLeavePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
