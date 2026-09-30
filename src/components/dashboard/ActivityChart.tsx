import React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { prefersReducedMotion } from '../../hooks/useInView';
import type { DayPoint } from '../../utils/dashboard';

const SERIES = [
  { key: 'Completed', label: 'Completed', color: '#10b981' },
  { key: 'Booked', label: 'Booked', color: '#1856f3' },
  { key: 'NoShow', label: 'No-show', color: '#f59e0b' },
  { key: 'Cancelled', label: 'Cancelled', color: '#cbd5e1' },
] as const;

/** Tick label: the weekday, with today called out. */
const DayTick: React.FC<{ x?: number; y?: number; payload?: { value: string }; points: DayPoint[] }> = ({ x = 0, y = 0, payload, points }) => {
  const index = points.findIndex((p) => p.date === payload?.value);
  const point = points[index];
  if (!point) return null;
  // Odd days drop their label on a phone (CSS), leaving room; today is always labelled.
  const odd = index % 2 === 1 && !point.isToday;
  return (
    <g transform={`translate(${x},${y + 12})`}>
      <text textAnchor="middle" className={`db-chart-tick ${point.isToday ? 'is-today' : ''} ${odd ? 'is-odd' : ''}`}>
        {point.isToday ? 'Today' : point.weekday}
      </text>
    </g>
  );
};

/**
 * Bookings per day across the loaded fortnight, stacked by status: what happened last week and
 * what is on the books for the coming one.
 */
export const ActivityChart: React.FC<{ points: DayPoint[] }> = ({ points }) => {
  const animate = !prefersReducedMotion();
  const total = points.reduce((sum, p) => sum + p.Booked + p.Completed + p.NoShow + p.Cancelled, 0);

  return (
    <section className="db-card db-activity" aria-labelledby="db-activity-title">
      <div className="db-card-head">
        <div>
          <h2 id="db-activity-title">Appointment activity</h2>
          <p>Last 7 days and the week ahead · {total} booking{total === 1 ? '' : 's'}</p>
        </div>
      </div>
      <ul className="db-legend" aria-hidden="true">
        {SERIES.map((s) => (
          <li key={s.key}>
            <span style={{ background: s.color }} /> {s.label}
          </li>
        ))}
      </ul>
      <div className="db-chart" role="img" aria-label={`Bar chart of ${total} bookings over two weeks, by day and status`}>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={points} margin={{ top: 8, right: 4, left: -24, bottom: 4 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="#eef2f8" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} interval={0} tick={<DayTick points={points} />} height={28} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <Tooltip
              cursor={{ fill: 'rgba(24, 86, 243, 0.06)', radius: 8 }}
              contentStyle={{ borderRadius: 12, border: '1px solid #e3eaf5', boxShadow: '0 16px 30px -18px rgba(15,23,42,.35)', fontSize: 12 }}
              labelFormatter={(date) => {
                const point = points.find((p) => p.date === date);
                return point ? `${point.weekday} ${point.label}${point.isToday ? ' · today' : ''}` : String(date);
              }}
            />
            {SERIES.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId="day"
                fill={s.color}
                radius={i === SERIES.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                isAnimationActive={animate}
                animationDuration={900}
                animationBegin={i * 120}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};

export default ActivityChart;
