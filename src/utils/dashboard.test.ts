import { describe, expect, it } from 'vitest';
import type { AppointmentSummary } from '../api/appointments';
import { dashboardPlan, greetingFor, summarise } from './dashboard';

function booking(overrides: Partial<AppointmentSummary>): AppointmentSummary {
  return {
    appointmentId: 'appt',
    patientId: 'patient-1',
    patientNumber: 'PAT-000123',
    patientName: 'Kamala Silva',
    doctorId: 'doctor-1',
    doctorName: 'Tathira Samarakoon',
    specialization: 'Neurology',
    slotId: 'slot-1',
    startUtc: '2026-10-05T03:30:00Z',
    endUtc: '2026-10-05T04:00:00Z',
    slotDate: '2026-10-05',
    durationMinutes: 30,
    serviceCode: 'GEN-CONSULT',
    status: 'Booked',
    createdAt: '2026-09-23T04:00:00Z',
    ...overrides,
  };
}

describe('dashboardPlan', () => {
  it('loads everything an admin may read', () => {
    expect(dashboardPlan('Admin')).toMatchObject({
      appointments: true,
      waitlist: true,
      staff: true,
      departments: true,
      doctors: true,
      canOpenAppointments: true,
    });
  });

  it('narrows a doctor to their own bookings and skips clinic-wide figures', () => {
    expect(dashboardPlan('Doctor', 'doctor-7')).toMatchObject({
      appointments: true,
      waitlist: true,
      staff: false,
      departments: false,
      doctors: false,
      doctorId: 'doctor-7',
    });
  });

  it('loads no bookings for a doctor account with no staff record, rather than the whole clinic', () => {
    expect(dashboardPlan('Doctor', null)).toMatchObject({ appointments: false, waitlist: false });
  });

  it('gives a nurse the schedule but not the waitlist or the appointment page', () => {
    expect(dashboardPlan('Nurse')).toMatchObject({
      appointments: true,
      waitlist: false,
      departments: false,
      canOpenAppointments: false,
    });
  });

  it('loads nothing for a patient', () => {
    expect(dashboardPlan('Patient')).toMatchObject({
      appointments: false,
      waitlist: false,
      staff: false,
      departments: false,
      doctors: false,
    });
  });
});

describe('summarise', () => {
  const today = '2026-10-05';
  // 04:00Z is 09:30 in Colombo.
  const now = new Date('2026-10-05T04:00:00Z');

  const appointments = [
    booking({ appointmentId: 'late', startUtc: '2026-10-05T08:00:00Z' }),
    booking({ appointmentId: 'done', startUtc: '2026-10-05T03:00:00Z', status: 'Completed' }),
    booking({ appointmentId: 'next', startUtc: '2026-10-05T05:00:00Z' }),
    booking({ appointmentId: 'gone', startUtc: '2026-10-05T06:00:00Z', status: 'Cancelled' }),
    booking({ appointmentId: 'missed', startUtc: '2026-10-05T02:00:00Z', status: 'Booked' }),
    booking({ appointmentId: 'tomorrow', slotDate: '2026-10-06', startUtc: '2026-10-06T04:00:00Z' }),
    booking({ appointmentId: 'last-week', slotDate: '2026-09-30', startUtc: '2026-09-30T04:00:00Z', status: 'NoShow' }),
  ];

  const summary = summarise(appointments, today, now, '2026-09-29', '2026-10-11');

  it('lists today in time order, every status', () => {
    expect(summary.today.map((a) => a.appointmentId)).toEqual(['missed', 'done', 'next', 'gone', 'late']);
  });

  it('counts today by status, and leaves cancelled out of the active total', () => {
    expect(summary.todayCounts).toEqual({ Booked: 3, Completed: 1, NoShow: 0, Cancelled: 1 });
    expect(summary.todayActive).toBe(4);
  });

  it('picks the next booked appointment that has not started yet', () => {
    // "missed" is still Booked but started before now, so it is not next.
    expect(summary.next?.appointmentId).toBe('next');
  });

  it('counts only still-booked appointments after today as upcoming', () => {
    expect(summary.upcoming).toBe(1);
  });

  it('has one point per day in the window, today marked', () => {
    expect(summary.trend).toHaveLength(13);
    const todayPoint = summary.trend.find((p) => p.isToday);
    expect(todayPoint).toMatchObject({ date: today, Booked: 3, Completed: 1, Cancelled: 1 });
    expect(summary.trend.find((p) => p.date === '2026-09-30')).toMatchObject({ NoShow: 1 });
  });
});

describe('greetingFor', () => {
  it.each([
    [3, 'Working late'],
    [8, 'Good morning'],
    [13, 'Good afternoon'],
    [20, 'Good evening'],
  ])('at %i:00 says %s', (hour, greeting) => {
    expect(greetingFor(hour)).toBe(greeting);
  });
});
