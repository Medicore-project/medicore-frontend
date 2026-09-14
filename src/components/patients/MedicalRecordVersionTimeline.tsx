import React from 'react';
import type { MedicalRecordResponse } from '../../api/medicalRecords';

interface MedicalRecordVersionTimelineProps {
  versions: MedicalRecordResponse[];
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'long',
  }).format(new Date(value));
}

export const MedicalRecordVersionTimeline: React.FC<MedicalRecordVersionTimelineProps> = ({ versions }) => {
  const orderedVersions = [...versions].sort((left, right) => right.version - left.version);

  return (
    <ol className="version-timeline" aria-label="Medical record version history">
      {orderedVersions.map((version) => (
        <li className="version-timeline-entry" key={version.versionId}>
          <span className="version-timeline-marker" aria-hidden="true" />
          <details open={version.isCurrent}>
            <summary>
              <span>
                Version {version.version}
                {version.isCurrent
                  ? <span className="version-current-label">Current</span>
                  : <span className="version-previous-label">Previous</span>}
              </span>
              <time dateTime={version.authoredAtUtc}>{formatDateTime(version.authoredAtUtc)}</time>
            </summary>
            <div className="version-content">
              <p>{version.clinicalNotes}</p>
              <dl className="version-metadata">
                <div><dt>Author</dt><dd>{version.authorClinicianEmail}</dd></div>
                <div><dt>Role</dt><dd>{version.authorClinicianRole}</dd></div>
                <div><dt>Visit reference</dt><dd><code>{version.visitReference}</code></dd></div>
              </dl>

              <div className="version-conditions">
                <strong>Conditions in this version</strong>
                {version.conditions.length === 0 ? (
                  <span>None recorded</span>
                ) : (
                  <ul>
                    {version.conditions.map((condition) => (
                      <li key={condition.conditionId}>
                        <span>{condition.name}{condition.code ? ` (${condition.code})` : ''}</span>
                        <span className={`badge condition-status-${condition.clinicalStatus.toLowerCase()}`}>
                          {condition.clinicalStatus}
                        </span>
                        {condition.notes && <small>{condition.notes}</small>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </details>
        </li>
      ))}
    </ol>
  );
};

export default MedicalRecordVersionTimeline;
