import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { MedicalRecordResponse, MedicalRecordSummary } from '../../api/medicalRecords';
import MedicalRecordTimeline from './MedicalRecordTimeline';
import MedicalRecordVersionTimeline from './MedicalRecordVersionTimeline';

const summary = (
  recordId: string,
  authoredAtUtc: string,
  clinicalNotesPreview: string,
): MedicalRecordSummary => ({
  recordId,
  versionId: `${recordId}-version`,
  patientId: 'patient-26',
  visitReference: '10000000-0000-4000-8000-000000000026',
  clinicalNotesPreview,
  conditionCount: 1,
  authorClinicianId: 'doctor-26',
  authorClinicianEmail: 'doctor@medicore.lk',
  authorClinicianRole: 'Doctor',
  authoredAtUtc,
  version: 2,
});

describe('MedicalRecordTimeline', () => {
  it('renders records newest first with clinical metadata and detail links', () => {
    render(
      <MemoryRouter>
        <MedicalRecordTimeline
          patientId="patient-26"
          records={[
            summary('older-record', '2026-09-12T08:00:00Z', 'Older clinical entry'),
            summary('newer-record', '2026-09-13T08:00:00Z', 'Newest clinical entry'),
          ]}
        />
      </MemoryRouter>,
    );

    const timeline = screen.getByRole('list', { name: 'Patient medical record timeline' });
    expect(within(timeline.children.item(0) as HTMLElement).getByText('Newest clinical entry')).toBeInTheDocument();
    expect(within(timeline.children.item(1) as HTMLElement).getByText('Older clinical entry')).toBeInTheDocument();
    expect(screen.getAllByText('doctor@medicore.lk')).toHaveLength(2);
    expect(screen.getAllByText('Current · v2')).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'View entry and history' })[0]).toHaveAttribute(
      'href',
      '/patients/patient-26/records/newer-record',
    );
  });

  it('identifies a system-authored entry as an imported completed appointment', () => {
    const imported = {
      ...summary('imported-record', '2026-09-14T05:00:00Z', 'Appointment completion notes'),
      authorClinicianId: 'appointment-service',
      authorClinicianEmail: 'appointment-service@internal',
      authorClinicianRole: 'System' as const,
      version: 1,
    };

    render(
      <MemoryRouter>
        <MedicalRecordTimeline patientId="patient-26" records={[imported]} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Imported visit · v1')).toBeInTheDocument();
    expect(screen.getByText('Completed appointment')).toBeInTheDocument();
    expect(screen.getByText(imported.visitReference)).toBeInTheDocument();
  });
});

describe('MedicalRecordVersionTimeline', () => {
  it('renders current and previous versions with retained condition snapshots', () => {
    const current: MedicalRecordResponse = {
      ...summary('record-26', '2026-09-13T08:00:00Z', 'Current notes'),
      clinicalNotes: 'Current notes',
      previousVersionId: 'previous-version',
      isCurrent: true,
      conditions: [{
        conditionId: 'current-condition',
        name: 'Hypertension',
        code: 'I10',
        clinicalStatus: 'Active',
        notes: 'Continue monitoring',
      }],
    };
    const previous: MedicalRecordResponse = {
      ...current,
      versionId: 'previous-version',
      version: 1,
      clinicalNotes: 'Previous notes',
      previousVersionId: null,
      isCurrent: false,
      conditions: [{
        conditionId: 'previous-condition',
        name: 'Migraine',
        clinicalStatus: 'Resolved',
      }],
    };

    render(<MedicalRecordVersionTimeline versions={[previous, current]} />);

    const timeline = screen.getByRole('list', { name: 'Medical record version history' });
    const currentVersion = timeline.children.item(0) as HTMLElement;
    const previousVersion = timeline.children.item(1) as HTMLElement;
    expect(within(currentVersion).getByText(/Version 2/)).toBeInTheDocument();
    expect(within(currentVersion).getByText('Current')).toBeInTheDocument();
    expect(within(previousVersion).getByText(/Version 1/)).toBeInTheDocument();
    expect(within(previousVersion).getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Hypertension (I10)')).toBeInTheDocument();
    expect(screen.getByText('Continue monitoring')).toBeInTheDocument();
    expect(screen.getByText('Migraine')).toBeInTheDocument();
  });
});
