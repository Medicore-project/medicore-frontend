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
import ClinicAppointmentsPage from './pages/ClinicAppointmentsPage';
import AppointmentDetailPage from './pages/AppointmentDetailPage';
import ProtectedRoute from './routes/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import LandingPage from './pages/LandingPage';
import PublicBookingPage from './pages/PublicBookingPage';
import InAppBookingPage from './pages/InAppBookingPage';
import {
  BOOKED_LIST_ROLES,
  BOOKING_ROLES,
  CLINIC_ROLES,
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
      {/* Public on purpose: a patient books without an account, identifying themselves with their
          patient number and date of birth instead. The booking endpoint still requires a token —
          one the patient service mints once they have done so. */}
      <Route path="/book" element={<PublicBookingPage />} />
      {/* Clinic staff only. These were open to any authenticated user, which became wrong once
          Patient became a role that can sign in: the APIs behind them already refuse a patient, so
          they would have seen raw errors on pages the sidebar never offered them. */}
      <Route element={<ProtectedRoute allowedRoles={[...CLINIC_ROLES]} />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={[...PATIENT_READER_ROLES]} />}>
        <Route element={<AppLayout />}>
          <Route path="/patients/:patientId/records" element={<PatientMedicalRecordsPage />} />
          <Route path="/patients/:patientId/records/:recordId" element={<MedicalRecordDetailPage />} />
          <Route path="/patients/:patientId/prescriptions" element={<PatientPrescriptionsPage />} />
          <Route path="/patients/:patientId/allergies" element={<PatientAllergiesPage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['Admin']} />}>
        <Route element={<AppLayout />}>
          <Route path="/staff" element={<StaffListPage />} />
          <Route path="/staff/:id" element={<StaffDetailPage />} />
          <Route path="/reports/audit" element={<AuditReportPage />} />
          <Route path="/reports/demographics" element={<DemographicsReportPage />} />
        </Route>
      </Route>
      {/* Readable by the front desk, writable only by Admin — the pages gate their own
          create/edit/delete controls, matching the identity service's AdminOnly write policy. */}
      <Route element={<ProtectedRoute allowedRoles={[...FRONT_DESK_ROLES]} />}>
        <Route element={<AppLayout />}>
          <Route path="/departments" element={<DepartmentsPage />} />
          <Route path="/specializations" element={<SpecializationsPage />} />
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
      {/* "Who is booked" — the front desk, and doctors, who open it on their own bookings. One
          appointment's page (SCRUM-36) is reached from that list; static segments like /booked
          and /book outrank this dynamic one, so they are unaffected. */}
      <Route element={<ProtectedRoute allowedRoles={[...BOOKED_LIST_ROLES]} />}>
        <Route element={<AppLayout />}>
          <Route path="/appointments/booked" element={<ClinicAppointmentsPage />} />
          <Route path="/appointments/:appointmentId" element={<AppointmentDetailPage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={[...SCHEDULE_READER_ROLES]} />}>
        <Route element={<AppLayout />}>
          <Route path="/appointments" element={<AppointmentsPage />} />
        </Route>
      </Route>
      {/* The same flow as the public page, inside the app shell. A signed-in patient still
          identifies with their patient number and date of birth — see BOOKING_ROLES. */}
      <Route element={<ProtectedRoute allowedRoles={[...BOOKING_ROLES]} />}>
        <Route element={<AppLayout />}>
          <Route path="/appointments/book" element={<InAppBookingPage />} />
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
