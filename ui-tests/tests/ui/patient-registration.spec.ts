import { RETURNING_PATIENT, newPatientForm } from '../../mocks/data';
import { expect, test } from '../../fixtures/ui-test';

/**
 * Front-desk patient registration (`/patients/register`, Patient service).
 * Covers the happy path, the three ways the service can refuse (duplicate, validation, permission)
 * and the browser-side validation that should stop a bad form before it is ever sent.
 */

test.beforeEach(async ({ signInAs, registrationPage }) => {
  await signInAs('Receptionist');
  await registrationPage.open();
});

test('registers a patient and shows the patient number to hand over', async ({ registrationPage: form, gateway }) => {
  await form.register(newPatientForm({ nic: '901234567v', email: 'NETHMI@EXAMPLE.TEST' }));

  await expect(form.success).toBeVisible();
  expect(await form.issuedPatientNumber()).toMatch(/^PAT-\d{6}$/);
  await expect(form.success).toContainText('Nethmi Rajapaksha');
  await expect(form.success.getByRole('button', { name: 'View patient profile' })).toBeVisible();

  const sent = gateway.lastCallTo('POST', '/patient/api/patients');
  // Normalised before it leaves the browser: NIC upper-cased, email lower-cased.
  expect(sent?.body).toMatchObject({ nic: '901234567V', email: 'nethmi@example.test' });
  // Sent with the receptionist's own token.
  expect(sent?.headers.authorization).toBe('Bearer staff-token-receptionist');
});

test('“Register another patient” resets the form', async ({ registrationPage: form }) => {
  await form.register(newPatientForm());
  await form.success.getByRole('button', { name: 'Register another patient' }).click();

  await expect(form.success).toHaveCount(0);
  await expect(form.field('nic')).toHaveValue('');
  await expect(form.field('firstName')).toHaveValue('');
});

test('a duplicate NIC shows the existing record instead of creating a second one', async ({ registrationPage: form }) => {
  await form.register(newPatientForm({ nic: RETURNING_PATIENT.nic }));

  await expect(form.duplicate).toBeVisible();
  await expect(form.duplicate).toContainText(RETURNING_PATIENT.patientNumber);
  await expect(form.duplicate).toContainText('no duplicate record was created');
  await expect(form.success).toHaveCount(0);
});

test('server-side validation errors are mapped back onto the right fields', async ({ registrationPage: form, gateway }) => {
  gateway.on('POST', '/patient/api/patients', {
    status: 400,
    json: {
      title: 'One or more validation errors occurred.',
      errors: { Email: ['This email is already used by another patient.'], District: ['Unknown district.'] },
    },
  });

  await form.register(newPatientForm({ district: 'Atlantis' }));

  await expect(form.requestError).toContainText('One or more validation errors occurred.');
  await expect(form.errorFor('email')).toHaveText('This email is already used by another patient.');
  await expect(form.errorFor('district')).toHaveText('Unknown district.');
});

test('a 403 from the service is explained, not shown as a crash', async ({ registrationPage: form, gateway }) => {
  gateway.on('POST', '/patient/api/patients', { status: 403, json: {} });
  await form.register(newPatientForm());

  await expect(form.requestError).toContainText('You do not have permission to register patients.');
});

test('an empty form flags every required field and sends nothing', async ({ registrationPage: form, gateway }) => {
  await form.submit.click();

  for (const key of ['nic', 'dateOfBirth', 'firstName', 'lastName', 'gender', 'email', 'phone', 'addressLine1', 'district'] as const) {
    await expect(form.errorFor(key), `${key} should be flagged`).toHaveText('This field is required.');
  }
  expect(gateway.callsTo('POST', '/patient/api/patients')).toHaveLength(0);
});

test('fixing a field clears its error straight away', async ({ registrationPage: form }) => {
  await form.fill(newPatientForm({ phone: '12345' }));
  await form.submit.click();
  await expect(form.errorFor('phone')).toContainText('Sri Lankan number');

  await form.field('phone').fill('+94771234567');
  await expect(form.errorFor('phone')).toHaveCount(0);
});

test('the submit button is locked while the request is in flight (no double registration)', async ({
  registrationPage: form,
  gateway,
}) => {
  gateway.on('POST', '/patient/api/patients', {
    delayMs: 1000,
    status: 201,
    json: { ...newPatientForm(), patientId: 'p1', patientNumber: 'PAT-000777', fullName: 'Nethmi Rajapaksha', createdAt: new Date().toISOString() },
  });

  await form.fill(newPatientForm());
  await form.submit.click();
  await expect(form.submit).toBeDisabled();
  await expect(form.submit).toHaveText('Registering…');
  // A frustrated second click must not send a second request.
  await form.submit.click({ force: true }).catch(() => undefined);

  await expect(form.success).toContainText('PAT-000777');
  expect(gateway.callsTo('POST', '/patient/api/patients')).toHaveLength(1);
});
