import { describe, expect, it } from 'vitest';
import { extractErrorMessage } from './apiError';

/** An axios-shaped rejection, which is all the helper actually inspects. */
function axiosError(status: number, data?: unknown) {
  return { response: { status, data } };
}

describe('extractErrorMessage', () => {
  it('prefers the first validation message, because it names the field that is wrong', () => {
    const err = axiosError(400, {
      title: 'Booking request validation failed.',
      errors: {
        slotId: ['A slot id is required.'],
        serviceCode: ['Service code must be one of: GEN-CONSULT, SPEC-CONSULT, FOLLOW-UP.'],
      },
    });

    expect(extractErrorMessage(err, 'fallback')).toBe('A slot id is required.');
  });

  it('falls back to the problem title when there are no field errors', () => {
    const err = axiosError(409, {
      title: 'This slot is no longer available; it is Booked.',
    });

    expect(extractErrorMessage(err, 'fallback')).toBe('This slot is no longer available; it is Booked.');
  });

  it('uses the detail when a problem carries one but no title', () => {
    const err = axiosError(500, { detail: 'Something went wrong upstream.' });

    expect(extractErrorMessage(err, 'fallback')).toBe('Something went wrong upstream.');
  });

  it('explains a 403, which the services return with no body at all', () => {
    expect(extractErrorMessage(axiosError(403), 'fallback')).toBe(
      'You do not have permission to do that.',
    );
  });

  it('ignores an empty errors list rather than reading past the end of it', () => {
    const err = axiosError(400, { title: 'Validation failed.', errors: { slotId: [] } });

    expect(extractErrorMessage(err, 'fallback')).toBe('Validation failed.');
  });

  it('uses a plain Error message when the request never reached a service', () => {
    expect(extractErrorMessage(new Error('Network Error'), 'fallback')).toBe('Network Error');
  });

  it('falls back when there is nothing useful to say', () => {
    expect(extractErrorMessage(axiosError(404), 'Failed to load the schedule.')).toBe(
      'Failed to load the schedule.',
    );
    expect(extractErrorMessage(undefined, 'Failed to load the schedule.')).toBe(
      'Failed to load the schedule.',
    );
    expect(extractErrorMessage('a bare string', 'Failed to load the schedule.')).toBe(
      'Failed to load the schedule.',
    );
  });
});
