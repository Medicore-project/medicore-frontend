import type { MedicalRecordSummary, PagedMedicalRecordResponse } from '../api/medicalRecords';

export function countNewMedicalRecords(
  current: PagedMedicalRecordResponse | null,
  refreshedPage: PagedMedicalRecordResponse,
): number {
  if (!current) return refreshedPage.items.length;

  const knownIds = new Set(current.items.map((record) => record.recordId));
  return refreshedPage.items.filter((record) => !knownIds.has(record.recordId)).length;
}

export function mergeRefreshedMedicalRecords(
  current: PagedMedicalRecordResponse | null,
  refreshedPage: PagedMedicalRecordResponse,
): PagedMedicalRecordResponse {
  if (!current) return refreshedPage;

  // Refreshed records win so changes on the first page replace stale timeline summaries.
  const recordsById = new Map<string, MedicalRecordSummary>();
  refreshedPage.items.forEach((record) => recordsById.set(record.recordId, record));
  current.items.forEach((record) => {
    if (!recordsById.has(record.recordId)) recordsById.set(record.recordId, record);
  });

  const items = [...recordsById.values()];
  return {
    ...refreshedPage,
    items,
    page: current.page,
    hasPreviousPage: current.hasPreviousPage,
    hasNextPage: items.length < refreshedPage.totalCount,
  };
}
