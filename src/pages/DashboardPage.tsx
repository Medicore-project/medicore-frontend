import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ActivityChart from '../components/dashboard/ActivityChart';
import KpiTile from '../components/dashboard/KpiTile';
import TodaySchedule from '../components/dashboard/TodaySchedule';
import {
  ArrowRightIcon,
  BuildingIcon,
  CalendarIcon,
  CalendarPlusIcon,
  ClockIcon,
  MoonIcon,
  PlaneIcon,
  RefreshIcon,
  SearchIcon,
  StethoscopeIcon,
  SunIcon,
  UserIcon,
  UsersIcon,
} from '../components/icons/LineIcons';
import { visibleItems } from '../components/layout/navigation';
import { colomboTimeLabel } from '../api/appointments';
import { useDashboardData } from '../hooks/useDashboardData';
import { colomboHour, DAYS_BACK, greetingFor, summarise } from '../utils/dashboard';
import { fullDateLabel } from '../utils/bookingLabels';
import { FRONT_DESK_ROLES } from '../utils/permissions';

/**
 * Shortcuts at the top of the page. Offered only where the role can open the page behind them:
 * `roles` when the action is narrower than its page (or its page is not in the sidebar), otherwise
 * the sidebar's own gate.
 */
const QUICK_ACTIONS: Array<{ label: string; path: string; icon: React.FC<{ className?: string }>; roles?: readonly string[] }> = [
  { label: 'Book appointment', path: '/appointments/book', icon: CalendarPlusIcon },
  { label: 'Register patient', path: '/patients/register', icon: UserIcon, roles: FRONT_DESK_ROLES },
  { label: 'Find a patient', path: '/patients', icon: SearchIcon },
  { label: 'Booked appointments', path: '/appointments/booked', icon: CalendarIcon },
  { label: 'Request leave', path: '/appointments/leave', icon: PlaneIcon, roles: ['Doctor'] },
  { label: 'Manage staff', path: '/staff', icon: UsersIcon },
];

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const role = user?.role;
  const { plan, data, today, from, to, lastUpdated, refreshing, refresh } = useDashboardData(role, user?.staffId);
  const displayName = user?.name || user?.email || 'there';
  const firstName = displayName.includes('@') ? displayName.split('@')[0] : displayName.split(' ')[0];
  const hour = colomboHour();
  const GreetingIcon = hour >= 6 && hour < 18 ? SunIcon : MoonIcon;

  const pages = useMemo(() => visibleItems(role), [role]);
  const reachable = (path: string) => pages.some((page) => page.path === path);

  const appointmentsSource = data.appointments;
  const appointments = useMemo(
    () => (appointmentsSource.status === 'skipped' ? [] : (appointmentsSource.data ?? [])),
    [appointmentsSource],
  );
  const summary = useMemo(() => summarise(appointments, today, new Date(), from, to), [appointments, today, from, to]);
  const waitlist = data.waitlist.status === 'skipped' ? [] : (data.waitlist.data ?? []);
  const openOffers = waitlist.filter((entry) => entry.status === 'Offered').length;

  const actions = QUICK_ACTIONS.filter((action) =>
    action.roles ? !!role && action.roles.includes(role) : reachable(action.path),
  ).slice(0, 4);

  const stateOf = (source: { status: string }) =>
    source.status === 'ready' ? 'ready' : source.status === 'error' ? 'error' : 'loading';

  const headline = (() => {
    if (!plan.appointments) return 'Here is your workspace for today.';
    if (data.appointments.status === 'loading' && !data.appointments.data) return 'Loading today’s schedule…';
    if (summary.todayActive === 0) return 'No appointments on the books for today yet.';
    const own = role === 'Doctor' ? 'You have' : 'The clinic has';
    const next = summary.next ? ` Next up at ${colomboTimeLabel(summary.next.startUtc)}.` : '';
    return `${own} ${summary.todayActive} appointment${summary.todayActive === 1 ? '' : 's'} today.${next}`;
  })();

  const workspaceCards = pages.filter((page) => page.path !== '/dashboard');

  return (
    <div className="db-page">
      {/* ── Greeting ─────────────────────────────────────────────── */}
      <section className="db-hero">
        <span className="db-hero-orb db-hero-orb--1" aria-hidden="true" />
        <span className="db-hero-orb db-hero-orb--2" aria-hidden="true" />
        <div className="db-hero-copy">
          <span className="db-hero-date">
            <GreetingIcon className="ws-icon-sm" /> {fullDateLabel(today)}
          </span>
          <h1>
            {greetingFor(hour)}, <span>{firstName}</span>
          </h1>
          <p>{headline}</p>
          <div className="db-hero-meta">
            <span className="db-role-pill">{role ?? 'Staff'}</span>
            <button type="button" className="db-refresh" onClick={refresh} disabled={refreshing} aria-label="Refresh dashboard">
              <RefreshIcon className={`ws-icon-sm ${refreshing ? 'is-spinning' : ''}`} />
              {refreshing ? 'Refreshing…' : lastUpdated ? `Updated ${colomboTimeLabel(lastUpdated.toISOString())}` : 'Refresh'}
            </button>
          </div>
        </div>

        {actions.length > 0 && (
          <nav className="db-actions" aria-label="Quick actions">
            {actions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Link key={action.path} to={action.path} className="db-action" style={{ '--i': index } as React.CSSProperties}>
                  <span className="db-action-icon" aria-hidden="true"><Icon className="ws-icon" /></span>
                  <span>{action.label}</span>
                  <ArrowRightIcon className="ws-icon-sm db-action-go" />
                </Link>
              );
            })}
          </nav>
        )}
      </section>

      {/* ── Figures ──────────────────────────────────────────────── */}
      <div className="db-kpis">
        {plan.appointments && (
          <KpiTile
            index={0}
            label={role === 'Doctor' ? 'My appointments today' : 'Appointments today'}
            value={data.appointments.status === 'loading' && !data.appointments.data ? undefined : summary.todayActive}
            state={stateOf(data.appointments)}
            icon={CalendarIcon}
            tone="blue"
            note={`${summary.todayCounts.Completed} completed · ${summary.todayCounts.Booked} still booked`}
            to={reachable('/appointments/booked') ? '/appointments/booked' : undefined}
          />
        )}
        {plan.appointments && (
          <KpiTile
            index={1}
            label="Coming up this week"
            value={data.appointments.status === 'loading' && !data.appointments.data ? undefined : summary.upcoming}
            state={stateOf(data.appointments)}
            icon={ClockIcon}
            tone="violet"
            note={summary.next ? `Next today at ${colomboTimeLabel(summary.next.startUtc)}` : 'Booked for the next six days'}
            to={reachable('/appointments') ? '/appointments' : undefined}
          />
        )}
        {plan.waitlist && (
          <KpiTile
            index={2}
            label="On the waitlist"
            value={data.waitlist.status === 'loading' && !data.waitlist.data ? undefined : waitlist.length}
            state={stateOf(data.waitlist)}
            icon={UsersIcon}
            tone="amber"
            note={openOffers ? `${openOffers} offer${openOffers === 1 ? '' : 's'} waiting for a reply` : 'Next two weeks'}
            to={reachable('/appointments/waitlist') ? '/appointments/waitlist' : undefined}
          />
        )}
        {plan.staff && (
          <KpiTile
            index={3}
            label="Active staff"
            value={data.staff.status === 'skipped' ? undefined : data.staff.data}
            state={stateOf(data.staff)}
            icon={UsersIcon}
            tone="teal"
            note="Accounts that can sign in"
            to="/staff"
          />
        )}
        {plan.departments && !plan.staff && (
          <KpiTile
            index={3}
            label="Departments"
            value={data.departments.status === 'skipped' ? undefined : data.departments.data}
            state={stateOf(data.departments)}
            icon={BuildingIcon}
            tone="teal"
            note="Across the hospital"
            to="/departments"
          />
        )}
        {plan.doctors && !plan.waitlist && (
          <KpiTile
            index={3}
            label="Bookable doctors"
            value={data.doctors.status === 'skipped' ? undefined : data.doctors.data}
            state={stateOf(data.doctors)}
            icon={StethoscopeIcon}
            tone="rose"
            note="Taking appointments"
          />
        )}
      </div>

      {/* ── Today and the fortnight ─────────────────────────────── */}
      {plan.appointments && (
        <div className="db-main-grid">
          <TodaySchedule
            appointments={summary.today}
            state={stateOf(data.appointments)}
            nextId={summary.next?.appointmentId}
            showDoctor={role !== 'Doctor'}
            canOpen={plan.canOpenAppointments}
          />
          <div className="db-side">
            <ActivityChart points={summary.trend} />
            <section className="db-card db-mix" aria-labelledby="db-mix-title">
              <div className="db-card-head">
                <div>
                  <h2 id="db-mix-title">Today by status</h2>
                  <p>{summary.today.length ? 'How the day is going so far' : 'Nothing booked yet'}</p>
                </div>
              </div>
              <div className="db-mix-bar" role="img" aria-label={`Booked ${summary.todayCounts.Booked}, completed ${summary.todayCounts.Completed}, no-show ${summary.todayCounts.NoShow}, cancelled ${summary.todayCounts.Cancelled}`}>
                {(['Completed', 'Booked', 'NoShow', 'Cancelled'] as const).map((status) => {
                  const share = summary.today.length ? (summary.todayCounts[status] / summary.today.length) * 100 : 0;
                  return share > 0 ? <span key={status} className={`db-mix-seg db-mix-seg--${status}`} style={{ width: `${share}%` }} /> : null;
                })}
              </div>
              <ul className="db-mix-legend">
                {(['Completed', 'Booked', 'NoShow', 'Cancelled'] as const).map((status) => (
                  <li key={status}>
                    <span className={`db-mix-dot db-mix-seg--${status}`} aria-hidden="true" />
                    {status === 'NoShow' ? 'No-show' : status}
                    <strong>{summary.todayCounts[status]}</strong>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}

      {/* ── Everything else this role can open ──────────────────── */}
      {workspaceCards.length > 0 && (
        <section className="db-workspace" aria-labelledby="db-workspace-title">
          <div className="db-section-head">
            <h2 id="db-workspace-title">Your workspace</h2>
            <p>Everything your role can open. Tip: press <kbd>Ctrl</kbd> <kbd>K</kbd> to jump anywhere.</p>
          </div>
          <div className="db-workspace-grid">
            {workspaceCards.map((page, index) => {
              const Icon = page.icon;
              return (
                <Link key={page.path} to={page.path} className="db-workspace-card" style={{ '--i': index } as React.CSSProperties}>
                  <span className="db-workspace-icon" aria-hidden="true"><Icon className="ws-icon" /></span>
                  <span className="db-workspace-text">
                    <strong>{page.name}</strong>
                    <span>{page.description}</span>
                  </span>
                  <ArrowRightIcon className="ws-icon-sm db-workspace-go" />
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

export default DashboardPage;
