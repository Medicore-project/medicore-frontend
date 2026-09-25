import { toColombo } from '../api/appointments';

/**
 * Date labels for the booking page. Assembled from parts rather than taken whole from
 * `toLocaleDateString`, whose punctuation differs between ICU builds, so every browser (and the
 * tests) read the same thing.
 */

function partsOf(isoDate: string, options: Intl.DateTimeFormatOptions) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(new Date(year, month - 1, day));
  return (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
}

/** `{ weekday: 'Thu', date: '25 Sep' }` — the two lines of a date chip. */
export function chipLabel(isoDate: string): { weekday: string; date: string } {
  const part = partsOf(isoDate, { weekday: 'short', day: 'numeric', month: 'short' });
  return { weekday: part('weekday'), date: `${part('day')} ${part('month')}` };
}

/** "Sun, 5 Oct 2026" — the summary's date line. */
export function fullDateLabel(isoDate: string): string {
  const part = partsOf(isoDate, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  return `${part('weekday')}, ${part('day')} ${part('month')} ${part('year')}`;
}

/**
 * Today's date in Colombo, as `YYYY-MM-DD`. Not the browser's today: a patient abroad is still
 * booking a Colombo clinic, and the slots' dates are Colombo dates.
 */
export function colomboToday(now: Date = new Date()): string {
  return toColombo(now.toISOString()).toISOString().slice(0, 10);
}

/** Every date from `from` to `to` inclusive, as `YYYY-MM-DD`. */
export function datesBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/** `YYYY-MM-DD` plus `days`. */
export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
