import React, { useId } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from '../icons/LineIcons';
import CountUp from '../motion/CountUp';

type KpiTileProps = {
  label: string;
  value?: number;
  state: 'loading' | 'ready' | 'error';
  icon: React.FC<{ className?: string }>;
  tone: 'blue' | 'green' | 'amber' | 'violet' | 'teal' | 'rose';
  note?: React.ReactNode;
  /** Where the tile leads; omitted when this role cannot open the page behind it. */
  to?: string;
  /** Recent values, oldest first, drawn as a small trend line. */
  spark?: number[];
  index?: number;
};

/** A trend line scaled to its own range, with a soft fill under it. Decorative: the figure says it all. */
const Sparkline: React.FC<{ values: number[] }> = ({ values }) => {
  const gradientId = useId();
  if (values.length < 2) return null;
  const width = 120;
  const height = 36;
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);
  const points = values.map((v, i) => [i * step, height - 4 - (v / max) * (height - 8)] as const);
  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <svg className="db-spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${width} ${height} L0 ${height} Z`} fill={`url(#${gradientId})`} />
      <path className="db-spark-line" d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
    </svg>
  );
};

export const KpiTile: React.FC<KpiTileProps> = ({ label, value, state, icon: Icon, tone, note, to, spark, index = 0 }) => {
  const body = (
    <>
      <span className="db-kpi-top">
        <span className="db-kpi-icon" aria-hidden="true">
          <Icon className="ws-icon" />
        </span>
        {to && <ArrowRightIcon className="ws-icon-sm db-kpi-go" />}
      </span>
      <span className="db-kpi-value">
        {state === 'loading' && value === undefined ? (
          <span className="db-skeleton db-skeleton--value" aria-label="Loading" />
        ) : value === undefined ? (
          <span title="Could not load">—</span>
        ) : (
          <CountUp to={value} durationMs={1100} />
        )}
      </span>
      <span className="db-kpi-label">{label}</span>
      <span className="db-kpi-note">
        {state === 'error' ? <span className="db-kpi-error">Couldn’t refresh — showing last figures</span> : note}
      </span>
      {spark && <Sparkline values={spark} />}
    </>
  );

  const className = `db-kpi db-tone-${tone} ${to ? 'is-link' : ''}`;
  const style = { '--i': index } as React.CSSProperties;
  return to ? (
    <Link to={to} className={className} style={style}>
      {body}
    </Link>
  ) : (
    <div className={className} style={style}>
      {body}
    </div>
  );
};

export default KpiTile;
