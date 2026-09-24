import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { colomboTimeLabel } from '../../api/appointments';
import type { AppointmentSummary } from '../../api/appointments';
import {
  CalendarIcon,
  ChevronDownIcon,
  ClockIcon,
  DotsIcon,
  DownloadIcon,
  ListIcon,
  SortIcon,
} from './BookedIcons';
import { dayLabel, toCsv } from '../../utils/bookedAppointments';

type SortKey = 'date' | 'time' | 'patient' | 'doctor' | 'service' | 'status';
type SortState = { key: SortKey; direction: 'asc' | 'desc' };

const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: 'date', label: 'Date' },
  { key: 'time', label: 'Time' },
  { key: 'patient', label: 'Patient' },
  { key: 'doctor', label: 'Doctor' },
  { key: 'service', label: 'Service' },
  { key: 'status', label: 'Status' },
];

/**
 * Date and time both sort by the start instant — "sort by time" across several days means
 * chronologically, not 09:00-on-every-day-first.
 */
function sortValue(a: AppointmentSummary, key: SortKey): string {
  switch (key) {
    case 'date':
    case 'time':
      return a.startUtc;
    case 'patient':
      return (a.patientName ?? '').toLowerCase();
    case 'doctor':
      return (a.doctorName ?? '').toLowerCase();
    case 'service':
      return a.serviceCode;
    case 'status':
      return a.status;
  }
}

function downloadCsv(rows: AppointmentSummary[]) {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `booked-appointments-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Closes an open menu on any click outside `ref`, or on Escape. */
function useDismiss(isOpen: boolean, close: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!isOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, close, ref]);
}

const ExportMenu: React.FC<{ rows: AppointmentSummary[] }> = ({ rows }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, ref);

  return (
    <div className="booked-menu-anchor" ref={ref}>
      <button
        type="button"
        className="booked-export-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        disabled={rows.length === 0}
      >
        <DownloadIcon className="booked-btn-icon" />
        Export
        <ChevronDownIcon className="booked-btn-chevron" />
      </button>
      {open && (
        <div className="booked-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              downloadCsv(rows);
              setOpen(false);
            }}
          >
            Download CSV
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              window.print();
            }}
          >
            Print
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * The per-row menu. Only actions that exist today: cancel and reschedule arrive with SCRUM-36, and
 * a menu offering them before then would be buttons that fail.
 */
const RowActions: React.FC<{ appointment: AppointmentSummary }> = ({ appointment }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, ref);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(appointment.appointmentId);
      setCopied(true);
    } catch {
      // Clipboard access can be refused (insecure context, permissions); nothing to recover.
    }
    setOpen(false);
  };

  return (
    <div className="booked-menu-anchor" ref={ref}>
      <button
        type="button"
        className="booked-row-action"
        aria-label={`Actions for ${appointment.patientName ?? 'this appointment'}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <DotsIcon />
      </button>
      {open && (
        <div className="booked-menu booked-menu--right" role="menu">
          <Link role="menuitem" to={`/patients/${appointment.patientId}`}>
            View patient profile
          </Link>
          <button type="button" role="menuitem" onClick={() => void copyId()}>
            {copied ? 'Copied' : 'Copy appointment ID'}
          </button>
        </div>
      )}
    </div>
  );
};

interface BookedTableProps {
  rows: AppointmentSummary[];
  isLoading: boolean;
}

const BookedTable: React.FC<BookedTableProps> = ({ rows, isLoading }) => {
  const [sort, setSort] = useState<SortState>({ key: 'date', direction: 'asc' });

  const sorted = useMemo(() => {
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const primary = sortValue(a, sort.key).localeCompare(sortValue(b, sort.key));
      // Ties fall back to chronological order, so equal names still read in time order.
      return primary !== 0 ? primary * factor : a.startUtc.localeCompare(b.startUtc);
    });
  }, [rows, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );

  return (
    <section className="booked-table-card">
      <header className="booked-table-header">
        <span className="booked-tile booked-tile--sm">
          <ListIcon />
        </span>
        <div className="booked-table-heading">
          <h2>Appointments ({rows.length})</h2>
          <p>Who is booked with which doctor, across the clinic.</p>
        </div>
        <ExportMenu rows={sorted} />
      </header>

      {isLoading ? (
        <p className="booked-table-empty">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="booked-table-empty">
          <p className="booked-table-empty-title">No appointments in this range</p>
          <p>Try a wider date range or another doctor.</p>
        </div>
      ) : (
        <div className="booked-table-scroll">
          <table className="booked-table" data-testid="clinic-appointments">
            <thead>
              <tr>
                {COLUMNS.map((column) => {
                  const active = sort.key === column.key;
                  return (
                    <th
                      key={column.key}
                      aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      <button type="button" className="booked-sort" onClick={() => toggleSort(column.key)}>
                        {column.label}
                        <SortIcon className="booked-sort-icon" direction={active ? sort.direction : null} />
                      </button>
                    </th>
                  );
                })}
                <th className="booked-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((a) => (
                <tr key={a.appointmentId}>
                  <td>
                    <span className="booked-cell-with-icon">
                      <CalendarIcon className="booked-cell-icon" />
                      {dayLabel(a.slotDate)}
                    </span>
                  </td>
                  <td>
                    <span className="booked-cell-with-icon">
                      <ClockIcon className="booked-cell-icon" />
                      <span>
                        <span className="booked-cell-main">{colomboTimeLabel(a.startUtc)}</span>
                        <span className="booked-cell-sub">{a.durationMinutes} min</span>
                      </span>
                    </span>
                  </td>
                  <td>
                    <Link to={`/patients/${a.patientId}`} className="booked-patient-link">
                      {a.patientName ?? 'Unnamed patient'}
                    </Link>
                    {a.patientNumber && <span className="booked-cell-sub">{a.patientNumber}</span>}
                  </td>
                  <td>
                    <span className="booked-cell-main">{a.doctorName ?? 'Unknown doctor'}</span>
                    {a.specialization && <span className="booked-cell-sub">{a.specialization}</span>}
                  </td>
                  <td>{a.serviceCode}</td>
                  <td>
                    <span className={`booked-status booked-status--${a.status.toLowerCase()}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="booked-actions-col">
                    <RowActions appointment={a} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default BookedTable;
