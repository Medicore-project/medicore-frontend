/**
 * Turns whatever a failed API call threw into one sentence worth showing a user.
 *
 * The services answer with RFC 7807 problem details, so the useful wording is already on the
 * response — `errors` for a validation failure, `title` for everything else. A 403 is special-cased
 * because ASP.NET returns it with no body at all, which would otherwise surface as the caller's
 * generic fallback and tell the user nothing.
 *
 * Extracted from AppointmentsPage and DoctorLeavePage, which each carried their own copy.
 */
export function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const axiosErr = err as {
      response?: {
        status?: number;
        data?: { title?: string; detail?: string; errors?: Record<string, string[]> };
      };
    };
    const data = axiosErr.response?.data;
    if (data?.errors) {
      const first = Object.values(data.errors)[0];
      if (first?.length) return first[0];
    }
    if (data?.title) return data.title;
    if (data?.detail) return data.detail;
    if (axiosErr.response?.status === 403) {
      return 'You do not have permission to do that.';
    }
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
