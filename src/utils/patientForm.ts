import type { CreatePatientBody, ValidationProblemResponse } from '../api/patients';

export type PatientForm = CreatePatientBody;
export type PatientFieldErrors = Partial<Record<keyof PatientForm, string>>;

export const EMPTY_PATIENT_FORM: PatientForm = {
  nic: '',
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  email: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  district: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
};

const NIC_PATTERN = /^(?:\d{12}|\d{9}[VX])$/;
const PHONE_PATTERN = /^(?:\+94|0)\d{9}$/;

export function normalizeNic(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizePhone(value: string): string {
  return value.replace(/[\s\-()]/g, '');
}

export function validatePatientForm(form: PatientForm, today: string): PatientFieldErrors {
  const errors: PatientFieldErrors = {};
  const requiredFields: Array<keyof PatientForm> = [
    'nic', 'firstName', 'lastName', 'dateOfBirth', 'gender',
    'email', 'phone', 'addressLine1', 'district',
  ];

  requiredFields.forEach((field) => {
    if (!form[field]?.trim()) errors[field] = 'This field is required.';
  });

  if (form.nic && !NIC_PATTERN.test(normalizeNic(form.nic))) {
    errors.nic = 'Enter 12 digits, or 9 digits followed by V or X.';
  }
  if (form.dateOfBirth && form.dateOfBirth > today) {
    errors.dateOfBirth = 'Date of birth cannot be in the future.';
  }
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  if (form.phone && !PHONE_PATTERN.test(normalizePhone(form.phone))) {
    errors.phone = 'Use a Sri Lankan number such as 0771234567 or +94771234567.';
  }
  if (form.emergencyContactPhone && !PHONE_PATTERN.test(normalizePhone(form.emergencyContactPhone))) {
    errors.emergencyContactPhone = 'Enter a valid Sri Lankan phone number.';
  }

  return errors;
}

export function normalizePatientForm(form: PatientForm): CreatePatientBody {
  return {
    ...form,
    nic: normalizeNic(form.nic),
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim().toLowerCase(),
    phone: normalizePhone(form.phone),
    addressLine1: form.addressLine1.trim(),
    addressLine2: form.addressLine2?.trim() || undefined,
    district: form.district.trim(),
    emergencyContactName: form.emergencyContactName?.trim() || undefined,
    emergencyContactPhone: form.emergencyContactPhone
      ? normalizePhone(form.emergencyContactPhone)
      : undefined,
  };
}

export function mapValidationErrors(
  errors: ValidationProblemResponse['errors'],
): PatientFieldErrors {
  if (!errors) return {};

  return Object.entries(errors).reduce<PatientFieldErrors>((result, [field, messages]) => {
    const key = `${field.charAt(0).toLowerCase()}${field.slice(1)}` as keyof PatientForm;
    if (key in EMPTY_PATIENT_FORM && messages.length > 0) result[key] = messages[0];
    return result;
  }, {});
}
