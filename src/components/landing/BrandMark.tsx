import React from 'react';
import { PlusIcon } from '../icons/LineIcons';

/** The MediCore logo used on the public pages: a blue tile with a cross, beside the name. */
export const BrandMark: React.FC<{ className?: string; tagline?: string }> = ({ className, tagline }) => (
  <span className={`mc-brand ${className ?? ''}`.trim()}>
    <span className="mc-brand-tile" aria-hidden="true">
      <PlusIcon className="mc-brand-plus" />
    </span>
    <span className="mc-brand-text">
      <span className="mc-brand-name">MediCore</span>
      {tagline && <span className="mc-brand-tagline">{tagline}</span>}
    </span>
  </span>
);

export default BrandMark;
