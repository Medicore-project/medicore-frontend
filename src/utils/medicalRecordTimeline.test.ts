import { describe, expect, it } from 'vitest';
import type { MedicalRecordSummary, PagedMedicalRecordResponse } from '../api/medicalRecords';
import { countNewMedicalRecords, mergeRefreshedMedicalRecords } from './medicalRecordTimeline';

const record = (recordId: string, preview = recordId): MedicalRecordSummary => ({
  recordId,
  versionId: `${recordId}-version`,
  patientId: 'patient-1',
  visitReference: `${recordId}-visit`,
  authorClinicianId: 'clinician-1',
  authorClinicianEmail: 'doctor@medicore.test',
  authorClinicianRole: 'Doctor',
  authoredAtUtc: '2026-09-14T05:00:00Z',
  version: 1,
  clinicalNotesPreview: preview,
  conditionCount: 0,
});

const page = (
  items: MedicalRecordSummary[],
  pageNumber: number,
  totalCount: number,
): PagedMedicalRecordResponse => ({
  items,
  totalCount,
  page: pageNumber,
  pageSize: 2,
  totalPages: Math.ceil(totalCount / 2),
  hasPreviousPage: pageNumber > 1,
  hasNextPage: pageNumber * 2 < totalCount,
});

describe('medical record timeline refresh', () => {
  it('prepends new visits, replaces refreshed summaries and preserves loaded older pages', () => {
    const current = page([record('record-2', 'stale'), record('record-1')], 2, 2);
    const refreshed = page([record('record-3'), record('record-2', 'current')], 1, 3);

    const merged = mergeRefreshedMedicalRecords(current, refreshed);

    expect(merged.items.map((item) => item.recordId)).toEqual(['record-3', 'record-2', 'record-1']);
    expect(merged.items.find((item) => item.recordId === 'record-2')?.clinicalNotesPreview).toBe('current');
    expect(merged.page).toBe(2);
    expect(merged.hasNextPage).toBe(false);
  });

  it('counts only records not already displayed', () => {
    const current = page([record('record-2'), record('record-1')], 1, 2);
    const refreshed = page([record('record-3'), record('record-2')], 1, 3);

    expect(countNewMedicalRecords(current, refreshed)).toBe(1);
  });
});
