import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colomboTimeLabel, type AppointmentSummary } from '../../api/appointments';
import { STATUS_META, statusLabel } from '../../utils/dashboard';
import { initialsOf } from '../../utils/initials';
import { CalendarIcon, ChevronRightIcon } from '../icons/LineIcons';

type TodayScheduleProps = {
  appointments: AppointmentSummary[];
  state: 'loading' | 'ready' | 'error';
  /** The next booked appointment, marked "Next up". */
  nextId?: string;
  /** Doctors see only their own list, so the doctor column would repeat their own name. */
  showDoctor: boolean;
  /** Rows open the appointment page for the roles whose route allows it. */
  canOpen: boolean;
};

const FILTERS = ['All', 'Booked', 'Completed', 'NoShow', 'Cancelled'] as const;
type Filter = (typeof FILTERS)[number];

/** Today's bookings in time order, filterable by status, each row opening its appointment. */
export const TodaySchedule: React.FC<TodayScheduleProps> = ({ appointments, state, nextId, showDoctor, canOpen }) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('All');
  const count = (f: Filter) => (f === 'All' ? appointments.length : appointments.filter((a) => a.status === f).length);
  const rows = filter === 'All' ? appointments : appointments.filter((a) => a.status === filter);

  return (
    <section className="db-card db-schedule" aria-labelledby="db-schedule-title">
      <div className="db-card-head">
        <div>
          <h2 id="db-schedule-title">Today’s schedule</h2>
          <p>
            {appointments.length
              ? `${appointments.length} booking${appointments.length === 1 ? '' : 's'} on ${showDoctor ? 'the clinic' : 'your'} calendar`
              : 'Every booking for today, in time order'}
          </p>
        </div>
      </div>

      <div className="db-filter-chips" role="group" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`db-chip ${filter === f ? 'is-active' : ''} ${f !== 'All' ? `db-tone-${STATUS_META[f].tone}` : ''}`}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {f === 'All' ? 'All' : statusLabel(f)}
            <span className="db-chip-count">{count(f)}</span>
          </button>
        ))}
      </div>

      {state === 'loading' && appointments.length === 0 ? (
        <ul className="db-schedule-list" aria-label="Loading today’s schedule">
          {[0, 1, 2].map((i) => (
            <li key={i} className="db-schedule-row db-schedule-row--skeleton">
              <span className="db-skeleton db-skeleton--time" />
              <span className="db-skeleton db-skeleton--avatar" />
              <span className="db-skeleton db-skeleton--line" />
            </li>
          ))}
        </ul>
      ) : state === 'error' && appointments.length === 0 ? (
        <div className="db-empty">
          <CalendarIcon className="db-empty-icon" />
          <strong>Today’s schedule could not be loaded</strong>
          <span>The appointment service did not answer. Try refreshing in a moment.</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="db-empty">
          <CalendarIcon className="db-empty-icon" />
          <strong>{filter === 'All' ? 'Nothing booked today' : `No ${statusLabel(filter).toLowerCase()} appointments today`}</strong>
          <span>{filter === 'All' ? 'New bookings appear here as soon as they are made.' : 'Pick another status to see the rest of the day.'}</span>
        </div>
      ) : (
        <ul className="db-schedule-list">
          {rows.map((a, index) => {
            const meta = STATUS_META[a.status];
            const isNext = a.appointmentId === nextId;
            const content = (
              <>
                <span className="db-time">
                  <strong>{colomboTimeLabel(a.startUtc)}</strong>
                  <span>{a.durationMinutes} min</span>
                </span>
                <span className="db-avatar" aria-hidden="true">{initialsOf(a.patientName ?? a.patientNumber ?? '?')}</span>
                <span className="db-who">
                  <strong>
                    {a.patientName ?? 'Unnamed patient'}
                    {isNext && <span className="db-next-pill">Next up</span>}
                  </strong>
                  <span>
                    {a.patientNumber ?? 'No patient number'}
                    {showDoctor && a.doctorName ? ` · ${a.doctorName}` : ''}
                    {showDoctor && a.specialization ? ` · ${a.specialization}` : ''}
                  </span>
                </span>
                <span className={`db-status db-tone-${meta?.tone ?? 'slate'}`}>{statusLabel(a.status)}</span>
                {canOpen && <ChevronRightIcon className="ws-icon-sm db-row-go" />}
              </>
            );
            return (
              <li
                key={a.appointmentId}
                className={`db-schedule-row ${isNext ? 'is-next' : ''}`}
                style={{ '--i': index } as React.CSSProperties}
              >
                {canOpen ? (
                  <button
                    type="button"
                    className="db-schedule-open"
                    onClick={() => navigate(`/appointments/${a.appointmentId}`)}
                    aria-label={`Open ${a.patientName ?? 'appointment'} at ${colomboTimeLabel(a.startUtc)}`}
                  >
                    {content}
                  </button>
                ) : (
                  <div className="db-schedule-open">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default TodaySchedule;
