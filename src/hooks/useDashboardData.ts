import { useCallback, useEffect, useMemo, useState } from 'react';
import { bookedApi, doctorApi, type AppointmentSummary } from '../api/appointments';
import { departmentsApi } from '../api/departments';
import { staffApi } from '../api/staff';
import { ACTIVE_WAITLIST_FILTER, staffWaitlistApi, type WaitlistEntry } from '../api/waitlist';
import { addDaysIso, colomboToday } from '../utils/bookingLabels';
import { DAYS_AHEAD, DAYS_BACK, dashboardPlan } from '../utils/dashboard';

/** One figure's state. `skipped` means this role may not load it, so its tile is not shown. */
export type Source<T> =
  | { status: 'skipped' }
  | { status: 'loading'; data?: T }
  | { status: 'ready'; data: T }
  | { status: 'error'; data?: T };

export type DashboardData = {
  appointments: Source<AppointmentSummary[]>;
  waitlist: Source<WaitlistEntry[]>;
  staff: Source<number>;
  departments: Source<number>;
  doctors: Source<number>;
};

const AUTO_REFRESH_MS = 120_000;

/**
 * Loads the dashboard's figures for the signed-in user. Every source loads independently, so one
 * service being down blanks one tile rather than the whole page; a refresh keeps the last good
 * figures on screen while it reloads.
 */
export function useDashboardData(role?: string, staffId?: string | null) {
  const plan = useMemo(() => dashboardPlan(role, staffId), [role, staffId]);
  const today = colomboToday();
  const from = addDaysIso(today, -DAYS_BACK);
  const to = addDaysIso(today, DAYS_AHEAD);

  const [data, setData] = useState<DashboardData>(() => ({
    appointments: plan.appointments ? { status: 'loading' } : { status: 'skipped' },
    waitlist: plan.waitlist ? { status: 'loading' } : { status: 'skipped' },
    staff: plan.staff ? { status: 'loading' } : { status: 'skipped' },
    departments: plan.departments ? { status: 'loading' } : { status: 'skipped' },
    doctors: plan.doctors ? { status: 'loading' } : { status: 'skipped' },
  }));
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let cancelled = false;

    function load<K extends keyof DashboardData>(key: K, enabled: boolean, request: () => Promise<unknown>) {
      if (!enabled) return Promise.resolve();
      return request().then(
        (value) => {
          if (!cancelled) setData((current) => ({ ...current, [key]: { status: 'ready', data: value } }));
        },
        () => {
          if (!cancelled)
            setData((current) => {
              const previous = current[key] as { data?: unknown };
              return { ...current, [key]: { status: 'error', data: previous.data } };
            });
        },
      );
    }

    Promise.all([
      load('appointments', plan.appointments, () => bookedApi.list({ doctorId: plan.doctorId, from, to })),
      load('waitlist', plan.waitlist, () =>
        staffWaitlistApi.list({ doctorId: plan.doctorId, from: today, to: addDaysIso(today, 13), status: ACTIVE_WAITLIST_FILTER }),
      ),
      load('staff', plan.staff, () => staffApi.list({ page: 1, pageSize: 1, isActive: true }).then((r) => r.totalCount)),
      load('departments', plan.departments, () => departmentsApi.list().then((list) => list.length)),
      load('doctors', plan.doctors, () => doctorApi.list().then((list) => list.length)),
    ]).then(() => {
      if (!cancelled) {
        setLastUpdated(new Date());
        setRefreshing(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [plan, from, to, today, generation]);

  // A quiet reload every couple of minutes, so a dashboard left open on the front desk stays current.
  useEffect(() => {
    const timer = window.setInterval(() => setGeneration((g) => g + 1), AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setGeneration((g) => g + 1);
  }, []);

  return { plan, data, today, from, to, lastUpdated, refreshing, refresh };
}
