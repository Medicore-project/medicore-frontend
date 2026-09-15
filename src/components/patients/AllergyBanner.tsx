import React, { useEffect, useState } from 'react';
import { allergyApi, type AllergyResponse } from '../../api/allergies';

interface AllergyBannerProps {
  patientId: string;
  /** compact = smaller inline version used on sub-pages (prescriptions, records) */
  compact?: boolean;
}

const SEVERITY_ORDER: Record<string, number> = {
  Severe: 0,
  Moderate: 1,
  Mild: 2,
  Unknown: 3,
};

function sortBySeverity(a: AllergyResponse, b: AllergyResponse): number {
  return (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4);
}

export const AllergyBanner: React.FC<AllergyBannerProps> = ({ patientId, compact = false }) => {
  const [active, setActive] = useState<AllergyResponse[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    allergyApi
      .list(patientId)
      .then((all) => {
        if (!cancelled) {
          setActive(all.filter((a) => a.status === 'Active').sort(sortBySeverity));
          setLoaded(true);
        }
      })
      .catch(() => {
        // Banner is non-blocking — silently hide on error rather than breaking the page
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [patientId]);

  // Don't render until data arrives; render nothing on zero active allergies
  if (!loaded || active.length === 0) return null;

  const hasSevere = active.some((a) => a.severity === 'Severe');

  return (
    <div
      className={`allergy-banner ${compact ? 'allergy-banner--compact' : ''} ${hasSevere ? 'allergy-banner--severe' : ''}`}
      role="alert"
      aria-label="Patient allergy warning"
    >
      <div className="allergy-banner-icon" aria-hidden="true">
        ⚠
      </div>

      <div className="allergy-banner-body">
        <p className="allergy-banner-title">
          {compact ? 'Known allergies' : `This patient has ${active.length} known ${active.length === 1 ? 'allergy' : 'allergies'}`}
        </p>

        <div className="allergy-banner-chips">
          {active.map((a) => (
            <span
              key={a.allergyId}
              className={`allergy-banner-chip allergy-chip--${a.severity.toLowerCase()}`}
              title={a.reaction ? `Reaction: ${a.reaction}` : undefined}
            >
              {a.allergen}
              <span className="allergy-chip-severity">{a.severity}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AllergyBanner;
