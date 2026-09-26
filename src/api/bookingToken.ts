/**
 * The short-lived token that lets someone who has identified themselves on the public booking page
 * book an appointment, without holding an account.
 *
 * Kept in module memory on purpose, **not** in `localStorage`. It is a bearer credential standing
 * for a patient's identity with a twenty-minute life, and the booking page is exactly the sort of
 * thing that runs on a shared clinic browser — a token must not outlive the tab. Losing it on
 * refresh is correct behaviour, not a bug: the flow simply restarts at "identify yourself".
 */

let token: string | null = null;
let expiresAtUtc: string | null = null;

/**
 * The requests the booking token is sent with — method and exact path, query string ignored.
 *
 * An allow-list rather than "send the booking token whenever there is one". A receptionist can be
 * logged in *and* hold a booking token while booking on someone's behalf; attaching it to
 * `/patient/api/patients/search` would answer 401 and throw them out mid-shift. The public reads
 * (`/appointment/api/public/booking/**`) need no credential at all and are deliberately absent.
 *
 * Exact, and by method, because `/appointment/api/appointments` is two endpoints: POST books (the
 * token's job) and GET is the *staff* list, which a booking token is refused on. A prefix match
 * would send a receptionist's list request with the patient's token they just booked with.
 *
 * SCRUM-36 adds the patient's own cancel and reschedule. They carry an appointment id, so they are
 * matched by a `pattern` anchored at both ends rather than an exact `path`. They live under
 * `mine/`, a different path from the staff `PUT {id}/cancel` and `PUT {id}/reschedule`, so a
 * receptionist holding a patient's token still cancels with their own.
 */
type BookingTokenRoute =
  | { readonly method: string; readonly path: string }
  | { readonly method: string; readonly pattern: RegExp };

export const BOOKING_TOKEN_ROUTES: readonly BookingTokenRoute[] = [
  { method: 'post', path: '/appointment/api/appointments' },
  { method: 'get', path: '/appointment/api/appointments/mine' },
  { method: 'put', pattern: /^\/appointment\/api\/appointments\/mine\/[^/]+\/(cancel|reschedule)$/ },
];

export function setBookingToken(value: string, expiresAt: string): void {
  token = value;
  expiresAtUtc = expiresAt;
}

/**
 * The token, or null once it has expired.
 *
 * Checking expiry here rather than letting the request 401 means the booking page can say "your
 * session expired, please identify yourself again" instead of surfacing an opaque failure.
 */
export function getBookingToken(): string | null {
  if (!token || !expiresAtUtc) return null;

  const expiry = Date.parse(expiresAtUtc);
  // An unparseable expiry is treated as expired: better to make someone identify again than to
  // send a credential of unknown age.
  if (Number.isNaN(expiry) || Date.now() >= expiry) {
    clearBookingToken();
    return null;
  }

  return token;
}

export function clearBookingToken(): void {
  token = null;
  expiresAtUtc = null;
}

/** When the current token expires, or null if there is none. Null once expired. */
export function bookingTokenExpiresAt(): string | null {
  return getBookingToken() === null ? null : expiresAtUtc;
}

/** Whether a request should carry the booking token. Axios lower-cases `method`; so does this. */
export function isBookingTokenRequest(method: string | undefined, url: string | undefined): boolean {
  if (url === undefined) return false;
  const path = url.split('?')[0];
  const verb = (method ?? 'get').toLowerCase();
  return BOOKING_TOKEN_ROUTES.some(
    (route) =>
      route.method === verb && ('path' in route ? route.path === path : route.pattern.test(path)),
  );
}
