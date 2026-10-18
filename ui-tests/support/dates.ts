/**
 * Date helpers that agree with the app: the clinic lives on Asia/Colombo time (UTC+05:30, no DST),
 * and the API speaks UTC instants plus Colombo calendar dates (`YYYY-MM-DD`).
 */

const COLOMBO_OFFSET_MS = 330 * 60_000;

/** Today's date in Colombo, as `YYYY-MM-DD`. */
export function colomboToday(now: Date = new Date()): string {
  return new Date(now.getTime() + COLOMBO_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The UTC instant of a Colombo wall-clock time, e.g. (`2026-10-20`, `09:00`) → `2026-10-20T03:30:00.000Z`. */
export function colomboToUtc(isoDate: string, hhmm: string): string {
  return new Date(Date.parse(`${isoDate}T${hhmm}:00Z`) - COLOMBO_OFFSET_MS).toISOString();
}

export function addMinutes(utcIso: string, minutes: number): string {
  return new Date(Date.parse(utcIso) + minutes * 60_000).toISOString();
}
