import { DOCTORS, RETURNING_PATIENT, newPatientForm, serviceCodeFor } from '../../mocks/data';
import { expect, test } from '../../fixtures/ui-test';

/**
 * The public booking flow (`/book`) — the most important screen a patient sees, and the one that
 * spans the most services: Patient (identify / register, mints the booking token) and Appointment
 * (doctors, slots, booking). Every backend answer here comes from the fake gateway, so each edge
 * case is forced deliberately rather than waited for.
 */

const [amara, nimal] = DOCTORS;

test.describe('Returning patient', () => {
  test('identifies, picks a doctor and a time, and books — with the booking token, not a staff token', async ({
    bookingPage: booking,
    gateway,
  }) => {
    await booking.open();
    await booking.identify(RETURNING_PATIENT.patientNumber, RETURNING_PATIENT.dateOfBirth);

    // The number they identified with stays on screen for the rest of the flow.
    await expect(booking.picker).toBeVisible();
    await expect(booking.patientCard).toContainText(RETURNING_PATIENT.patientNumber);
    await expect(booking.patientCard).toContainText(RETURNING_PATIENT.fullName);

    await booking.chooseDoctor(amara.doctorId);
    const picked = await booking.pickSlot(0);

    // The summary reviews what is about to be booked, and says nothing is charged yet.
    await expect(booking.summary).toContainText(amara.fullName);
    await expect(booking.summary).toContainText(picked.time);
    await expect(booking.billingNotice.first()).toContainText('No payment is taken now');
    await expect(booking.billingNotice.first()).toContainText(serviceCodeFor(amara.specialization));

    await booking.confirm();

    await expect(booking.confirmation).toContainText('Your appointment is confirmed');
    await expect(booking.confirmation).toContainText(amara.fullName);
    await expect(booking.confirmation).toContainText(picked.time);

    // Contract: the UI sent the slot and the derived service code — never a patient id, which the
    // service takes from the token — and authenticated with the booking token it was just given.
    const book = gateway.lastCallTo('POST', '/appointment/api/appointments');
    expect(book?.body).toEqual({ slotId: picked.slotId, serviceCode: serviceCodeFor(amara.specialization) });
    expect(book?.headers.authorization).toBe(`Bearer booking-token-${RETURNING_PATIENT.patientNumber}`);
    // A bearer credential that stands for a patient must not outlive the tab.
    expect(await booking.page.evaluate(() => JSON.stringify(localStorage))).not.toContain('booking-token');
  });

  test('a booked time is no longer offered', async ({ bookingPage: booking }) => {
    await booking.open();
    await booking.identify(RETURNING_PATIENT.patientNumber, RETURNING_PATIENT.dateOfBirth);
    await booking.chooseDoctor(amara.doctorId);
    const picked = await booking.pickSlot(0);
    await booking.confirm();
    await expect(booking.confirmation).toBeVisible();

    await booking.confirmation.getByRole('button', { name: 'Book another appointment' }).click();
    await booking.chooseDate(picked.date);

    await expect(booking.slotOptions.first()).toBeVisible();
    await expect.poll(() => booking.offeredSlotIds()).not.toContain(picked.slotId);
  });

  test('an unknown number or wrong date of birth is refused with one deliberately vague message', async ({
    bookingPage: booking,
    gateway,
  }) => {
    await booking.open();
    // Right number, wrong date: must read exactly like a wrong number, or the page leaks which
    // sequential patient numbers exist.
    await booking.identify(RETURNING_PATIENT.patientNumber, '1991-01-01');

    await expect(booking.stepAlert()).toHaveText(
      'We could not find a patient with that number and date of birth. Check both, or register as a new patient.',
    );
    await expect(booking.identifyForm).toBeVisible();
    await expect(booking.patientCard).toHaveCount(0);
    expect(gateway.callsTo('POST', '/appointment/api/appointments')).toHaveLength(0);
  });

  test('missing details are caught in the browser without calling the service', async ({ bookingPage: booking, gateway }) => {
    await booking.open();
    await booking.patientNumber.fill(RETURNING_PATIENT.patientNumber);
    await booking.continueButton.click();

    await expect(booking.stepAlert()).toHaveText('Enter your patient number and date of birth.');
    expect(gateway.callsTo('POST', '/patient/api/patients/identify')).toHaveLength(0);
  });
});

test.describe('New patient', () => {
  test('registers, receives a patient number, and books in the same visit', async ({ bookingPage: booking, gateway }) => {
    const details = newPatientForm({
      // Sloppy-but-valid input, to prove the form normalises before sending.
      nic: '200045678901',
      phone: '077 123-4567',
      email: '  Nethmi.R@Example.TEST ',
    });

    await booking.open();
    await booking.startAsNewPatient();
    await booking.register(details);

    await expect(booking.picker).toBeVisible();
    await expect(booking.patientCard).toContainText('You are registered');
    await expect(booking.patientCard).toContainText('Keep this number');
    const issued = await booking.shownPatientNumber();
    expect(issued).toMatch(/^PAT-\d{6}$/);

    expect(gateway.lastCallTo('POST', '/patient/api/patients/public-register')?.body).toMatchObject({
      nic: '200045678901',
      phone: '0771234567',
      email: 'nethmi.r@example.test',
      firstName: 'Nethmi',
      gender: 'Female',
    });

    await booking.chooseDoctor(nimal.doctorId);
    await booking.pickSlot(1);
    await booking.confirm();

    await expect(booking.confirmation).toContainText('Your appointment is confirmed');
    // The number they must leave with has not changed during booking.
    expect(await booking.shownPatientNumber()).toBe(issued);
  });

  // Parameterised validation: each row breaks exactly one rule.
  const invalid: Array<{ name: string; field: Record<string, string>; label: string; message: string }> = [
    { name: 'NIC with 10 digits', field: { nic: '1234567890' }, label: 'NIC *', message: 'Enter 12 digits, or 9 digits followed by V or X.' },
    { name: 'old NIC without the letter', field: { nic: '901234567' }, label: 'NIC *', message: 'Enter 12 digits, or 9 digits followed by V or X.' },
    { name: 'foreign phone number', field: { phone: '+447700900123' }, label: 'Phone *', message: 'Use a Sri Lankan number such as 0771234567 or +94771234567.' },
    { name: 'phone too short', field: { phone: '07712345' }, label: 'Phone *', message: 'Use a Sri Lankan number such as 0771234567 or +94771234567.' },
    { name: 'email without a domain', field: { email: 'nethmi@' }, label: 'Email *', message: 'Enter a valid email address.' },
    { name: 'date of birth in the future', field: { dateOfBirth: '2999-01-01' }, label: 'Date of birth *', message: 'Date of birth cannot be in the future.' },
    { name: 'blank first name', field: { firstName: '   ' }, label: 'First name *', message: 'This field is required.' },
  ];

  for (const { name, field, label, message } of invalid) {
    test(`rejects ${name} before calling the service`, async ({ bookingPage: booking, gateway }) => {
      await booking.open();
      await booking.startAsNewPatient();
      await booking.register(newPatientForm(field));

      await expect(booking.stepAlert()).toHaveText('Please correct the highlighted fields.');
      await expect(booking.fieldError(label)).toHaveText(message);
      expect(gateway.callsTo('POST', '/patient/api/patients/public-register')).toHaveLength(0);
    });
  }

  test('an already-registered NIC is pointed back to identification, without naming whose it is', async ({
    bookingPage: booking,
  }) => {
    await booking.open();
    await booking.startAsNewPatient();
    await booking.register(newPatientForm({ nic: RETURNING_PATIENT.nic }));

    await expect(booking.stepAlert()).toHaveText(
      'A patient with this NIC is already registered. Use your patient number and date of birth instead.',
    );
    await expect(booking.stepAlert()).not.toContainText(RETURNING_PATIENT.fullName);
    await expect(booking.registerForm).toBeVisible();
  });
});

test.describe('Choosing a doctor', () => {
  test('filtering by specialization narrows the doctors and auto-selects a single match', async ({
    bookingPage: booking,
    gateway,
  }) => {
    await booking.open();
    await booking.identify(RETURNING_PATIENT.patientNumber, RETURNING_PATIENT.dateOfBirth);
    await expect.poll(() => booking.offeredDoctorIds()).toEqual([amara.doctorId, nimal.doctorId]);

    await booking.specialization.selectOption('Cardiology');

    await expect(booking.doctor).toHaveValue(nimal.doctorId);
    await expect.poll(() => booking.offeredDoctorIds()).toEqual([nimal.doctorId]);
    expect(gateway.lastCallTo('GET', '/appointment/api/public/booking/doctors')?.query.get('specialization')).toBe('Cardiology');
    // One doctor → their times load without another click.
    await expect(booking.slotOptions.first()).toBeVisible();
  });

  test('no bookable doctors shows guidance instead of an empty dropdown', async ({ bookingPage: booking, gateway }) => {
    gateway.on('GET', '/appointment/api/public/booking/doctors', { json: [] });
    await booking.open();
    await booking.identify(RETURNING_PATIENT.patientNumber, RETURNING_PATIENT.dateOfBirth);

    await expect(booking.noDoctorsMessage).toBeVisible();
    await expect(booking.doctor).toBeDisabled();
    await expect(booking.confirmButton).toBeDisabled();
  });

  test('a doctor with no free times says so', async ({ bookingPage: booking, gateway }) => {
    gateway.on('GET', '/appointment/api/public/booking/slots', { json: [] });
    await booking.open();
    await booking.identify(RETURNING_PATIENT.patientNumber, RETURNING_PATIENT.dateOfBirth);
    await booking.chooseDoctor(amara.doctorId);

    await expect(booking.picker.getByText('No free times for this doctor')).toBeVisible();
  });

  test('confirm stays disabled until a time is chosen', async ({ bookingPage: booking }) => {
    await booking.open();
    await booking.identify(RETURNING_PATIENT.patientNumber, RETURNING_PATIENT.dateOfBirth);
    await expect(booking.confirmButton).toBeDisabled();

    await booking.chooseDoctor(amara.doctorId);
    await expect(booking.confirmButton).toBeDisabled();

    await booking.pickSlot(0);
    await expect(booking.confirmButton).toBeEnabled();
  });
});

test.describe('Recovering from failures', () => {
  test('a slot taken by someone else a moment ago keeps the patient and reloads the times', async ({
    bookingPage: booking,
    gateway,
  }) => {
    await booking.open();
    await booking.identify(RETURNING_PATIENT.patientNumber, RETURNING_PATIENT.dateOfBirth);
    await booking.chooseDoctor(amara.doctorId);
    const picked = await booking.pickSlot(0);

    // Race: between listing and booking, another patient takes this slot.
    gateway.state.freeSlots.set(
      amara.doctorId,
      (gateway.state.freeSlots.get(amara.doctorId) ?? []).filter((slot) => slot.slotId !== picked.slotId),
    );
    const slotLoadsBefore = gateway.callsTo('GET', '/appointment/api/public/booking/slots').length;

    await booking.confirm();

    await expect(booking.stepAlert()).toHaveText('Someone booked this slot a moment ago. Please choose another time.');
    await expect(booking.confirmation).toHaveCount(0);
    // Nothing they did is lost: same patient, same day, fresh times without the taken one.
    await expect(booking.patientCard).toContainText(RETURNING_PATIENT.patientNumber);
    await expect.poll(() => gateway.callsTo('GET', '/appointment/api/public/booking/slots').length).toBeGreaterThan(slotLoadsBefore);
    await expect(booking.page.locator(`[data-testid="date-option"][data-date="${picked.date}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => booking.offeredSlotIds()).not.toContain(picked.slotId);
    await expect(booking.confirmButton).toBeDisabled();
  });

  test('an expired booking session sends the patient back to identify, with an explanation', async ({
    bookingPage: booking,
    gateway,
  }) => {
    gateway.on('POST', '/appointment/api/appointments', { status: 401, json: { title: 'Unauthorized' } });
    await booking.open();
    await booking.identify(RETURNING_PATIENT.patientNumber, RETURNING_PATIENT.dateOfBirth);
    await booking.chooseDoctor(amara.doctorId);
    await booking.pickSlot(0);
    await booking.confirm();

    await expect(booking.identifyForm).toBeVisible();
    await expect(booking.stepAlert()).toHaveText('Your booking session expired. Please identify yourself again.');
    await expect(booking.patientCard).toHaveCount(0);
    // A patient's expired token must never be "refreshed" into a staff redirect.
    await expect(booking.page).toHaveURL(/\/book$/);
  });

  test('a failing slot service shows its message instead of an empty grid', async ({ bookingPage: booking, gateway }) => {
    gateway.on('GET', '/appointment/api/public/booking/slots', {
      status: 503,
      json: { title: 'The appointment service is temporarily unavailable.' },
    });
    await booking.open();
    await booking.identify(RETURNING_PATIENT.patientNumber, RETURNING_PATIENT.dateOfBirth);
    await booking.chooseDoctor(amara.doctorId);

    await expect(booking.stepAlert()).toHaveText('The appointment service is temporarily unavailable.');
  });

  test('“Change patient” forgets the identity and its token', async ({ bookingPage: booking, gateway }) => {
    await booking.open();
    await booking.identify(RETURNING_PATIENT.patientNumber, RETURNING_PATIENT.dateOfBirth);
    await expect(booking.patientCard).toBeVisible();

    await booking.patientCard.getByRole('button', { name: /change patient/i }).click();

    await expect(booking.identifyForm).toBeVisible();
    await expect(booking.patientCard).toHaveCount(0);
    // The next identify must start from nothing: no stale token on the call.
    await booking.identify(RETURNING_PATIENT.patientNumber, RETURNING_PATIENT.dateOfBirth);
    expect(gateway.lastCallTo('POST', '/patient/api/patients/identify')?.headers.authorization).toBeUndefined();
  });
});
