import axios from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { patientApi, type PatientProfileResponse } from '../api/patients';
import AllergyBanner from '../components/patients/AllergyBanner';
import PatientEditModal from '../components/patients/PatientEditModal';
import { useAuth } from '../contexts/AuthContext';
import { canManagePatientProfiles } from '../utils/permissions';

function formatDate(value?: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value));
}

export const PatientProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const canManagePatients = canManagePatientProfiles(user?.role);
  const location = useLocation();
  const patientSearch = (location.state as { patientSearch?: string } | null)?.patientSearch;
  const patientsPath = patientSearch ? `/patients?${patientSearch}` : '/patients';
  const [patient, setPatient] = useState<PatientProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadPatient = useCallback(async () => {
    if (!id) {
      setError('Invalid patient identifier.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      setPatient(await patientApi.getById(id));
    } catch (requestError: unknown) {
      if (axios.isAxiosError(requestError) && requestError.response?.status === 404) {
        setError('Patient not found or the profile has been deleted.');
      } else if (axios.isAxiosError(requestError) && requestError.response?.status === 403) {
        setError('You do not have permission to view this patient.');
      } else {
        setError('Failed to load the patient profile.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- route changes require loading the matching profile
    void loadPatient();
  }, [loadPatient]);

  const handleDelete = async () => {
    if (!id || !patient) return;
    if (!window.confirm(`Delete ${patient.fullName} (${patient.patientNumber})? This will archive the profile.`)) return;

    setIsDeleting(true);
    setError(null);
    try {
      await patientApi.remove(id);
      setIsDeleted(true);
      setPatient(null);
    } catch (requestError: unknown) {
      if (axios.isAxiosError(requestError) && requestError.response?.status === 404) {
        setError('Patient not found or already deleted.');
      } else {
        setError('Failed to delete the patient. Please try again.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <div className="table-loading"><div className="spinner" /><p>Loading patient profile…</p></div>;
  }

  if (isDeleted) {
    return (
      <div className="management-page">
        <section className="registration-result registration-success" role="status">
          <span className="registration-result-label">Patient profile deleted</span>
          <p>The profile was archived and will no longer appear in patient queries.</p>
          <Link className="btn btn-primary" to={patientsPath}>Return to patient search</Link>
        </section>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="management-page">
        <div className="alert alert-danger" role="alert">{error ?? 'Patient not found.'}</div>
        <Link className="btn btn-secondary profile-back-link" to={patientsPath}>← Back to patients</Link>
      </div>
    );
  }

  return (
    <div className="management-page patient-profile-page">
      <div className="page-header">
        <div>
          <Link className="profile-breadcrumb" to={patientsPath}>Patients</Link>
          <h1>{patient.fullName}</h1>
          <p className="page-subtitle">Patient number: <strong>{patient.patientNumber}</strong></p>
        </div>
        <div className="profile-actions">
          <Link className="btn btn-primary" to={`/patients/${patient.patientId}/records`}>Medical records</Link>
          <Link className="btn btn-outline" to={`/patients/${patient.patientId}/prescriptions`}>Prescriptions</Link>
          <Link className="btn btn-danger-outline" to={`/patients/${patient.patientId}/allergies`}>Allergies</Link>
          {canManagePatients && (
            <>
              <button type="button" className="btn btn-outline" onClick={() => setIsEditing(true)}>Edit profile</button>
              <button type="button" className="btn btn-danger-outline" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? 'Deleting…' : 'Delete patient'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {successMessage && (
        <div className="alert alert-success" role="status">
          <span>{successMessage}</span>
          <button type="button" className="alert-close" onClick={() => setSuccessMessage(null)}>×</button>
        </div>
      )}

      {/* Allergy banner — shows only when active allergies exist */}
      <AllergyBanner patientId={patient.patientId} />

      <section className="detail-card">
        <h2 className="detail-section-title">Identity and personal details</h2>
        <div className="patient-profile-grid">
          <div><span>Patient number</span><strong>{patient.patientNumber}</strong></div>
          <div><span>NIC</span><strong>{patient.nic}</strong></div>
          <div><span>Date of birth</span><strong>{formatDate(patient.dateOfBirth)}</strong></div>
          <div><span>Gender</span><strong>{patient.gender === 'PreferNotToSay' ? 'Prefer not to say' : patient.gender}</strong></div>
        </div>
      </section>

      <section className="detail-card">
        <h2 className="detail-section-title">Contact details</h2>
        <div className="patient-profile-grid">
          <div><span>Email</span><strong>{patient.email}</strong></div>
          <div><span>Phone</span><strong>{patient.phone}</strong></div>
          <div><span>Address</span><strong>{[patient.addressLine1, patient.addressLine2].filter(Boolean).join(', ')}</strong></div>
          <div><span>District</span><strong>{patient.district}</strong></div>
        </div>
      </section>

      <section className="detail-card">
        <h2 className="detail-section-title">Emergency contact</h2>
        <div className="patient-profile-grid">
          <div><span>Name</span><strong>{patient.emergencyContactName || '—'}</strong></div>
          <div><span>Phone</span><strong>{patient.emergencyContactPhone || '—'}</strong></div>
        </div>
      </section>

      <p className="profile-meta">
        Created {formatDate(patient.createdAt)} · Last updated {formatDate(patient.updatedAt)}
      </p>

      {canManagePatients && isEditing && (
        <PatientEditModal
          patient={patient}
          onClose={() => setIsEditing(false)}
          onSuccess={(updatedPatient) => {
            setPatient(updatedPatient);
            setIsEditing(false);
            setSuccessMessage('Patient details updated successfully.');
          }}
        />
      )}
    </div>
  );
};

export default PatientProfilePage;
