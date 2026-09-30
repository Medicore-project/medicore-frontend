import { describe, expect, it } from 'vitest';
import { pageTitleFor, visibleSections } from './navigation';

describe('pageTitleFor', () => {
  it('names a sidebar page with its section', () => {
    expect(pageTitleFor('/appointments/waitlist')).toEqual({ section: 'Appointments', title: 'Waitlist' });
  });

  it('names a page opened from another one after its parent', () => {
    expect(pageTitleFor('/patients/abc-123/prescriptions')).toEqual({ section: 'Patients', title: 'Prescriptions' });
    expect(pageTitleFor('/appointments/appt-1')).toEqual({ section: 'Booked Appointments', title: 'Appointment' });
  });

  it('does not mistake the booking page for an appointment id', () => {
    expect(pageTitleFor('/appointments/book')).toEqual({ section: 'Appointments', title: 'Book Appointment' });
  });
});

describe('visibleSections', () => {
  it('drops a section with nothing this role can open', () => {
    const titles = visibleSections('Nurse').map((section) => section.title);

    expect(titles).not.toContain('Reports');
    expect(titles).not.toContain('Organisation');
    expect(titles).toContain('Appointments');
  });
});
