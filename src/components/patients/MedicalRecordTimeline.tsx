import React from 'react';
import { Link } from 'react-router-dom';
import type { MedicalRecordSummary } from '../../api/medicalRecords';

interface MedicalRecordTimelineProps {
  patientId: string;
  records: MedicalRecordSummary[];
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export const MedicalRecordTimeline: React.FC<MedicalRecordTimelineProps> = ({ patientId, records }) => {
  const orderedRecords = [...records].sort(
    (left, right) => new Date(right.authoredAtUtc).getTime() - new Date(left.authoredAtUtc).getTime(),
  );

  return (
    <ol className="medical-record-timeline" aria-label="Patient medical record timeline">
      {orderedRecords.map((record) => (
        <li className="medical-timeline-entry" key={record.recordId}>
          <div className="medical-timeline-marker" aria-hidden="true" />
          <article className="medical-timeline-card">
            <header className="medical-timeline-header">
              <div>
                <time dateTime={record.authoredAtUtc}>{formatDate(record.authoredAtUtc)}</time>
                <span>{formatTime(record.authoredAtUtc)}</span>
              </div>
              <span className="badge badge-success">
                {record.authorClinicianRole === 'System' ? 'Imported visit' : 'Current'} · v{record.version}
              </span>
            </header>

            <p className="medical-timeline-preview">
              {record.clinicalNotesPreview || 'No clinical-note preview available.'}
            </p>

            <dl className="medical-timeline-metadata">
              <div>
                <dt>{record.authorClinicianRole === 'System' ? 'Source' : 'Clinician'}</dt>
                <dd>
                  {record.authorClinicianRole === 'System'
                    ? 'Completed appointment'
                    : record.authorClinicianEmail}
                </dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{record.authorClinicianRole}</dd>
              </div>
              <div>
                <dt>Conditions</dt>
                <dd>{record.conditionCount}</dd>
              </div>
              <div>
                <dt>Visit reference</dt>
                <dd><code>{record.visitReference}</code></dd>
              </div>
            </dl>

            <footer className="medical-timeline-footer">
              <span>Record {record.recordId}</span>
              <Link className="btn btn-outline btn-sm" to={`/patients/${patientId}/records/${record.recordId}`}>
                View entry and history
              </Link>
            </footer>
          </article>
        </li>
      ))}
    </ol>
  );
};

export default MedicalRecordTimeline;
