import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from './client';
import { serviceTariffApi } from './serviceTariffs';

vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const get = vi.mocked(apiClient.get);
const post = vi.mocked(apiClient.post);
const put = vi.mocked(apiClient.put);
const remove = vi.mocked(apiClient.delete);

describe('serviceTariffApi (SCRUM-45)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists the complete effective-dated catalogue', async () => {
    get.mockResolvedValueOnce({ data: [{ tariffId: 'tariff-1' }] });

    await expect(serviceTariffApi.list(true)).resolves.toEqual([{ tariffId: 'tariff-1' }]);
    expect(get).toHaveBeenCalledWith('/billing/api/service-tariffs', {
      params: { includeInactive: true },
    });
  });

  it('creates, versions and deactivates tariffs through the billing gateway', async () => {
    const createRequest = {
      serviceCode: 'LAB-CBC',
      description: 'Complete blood count',
      unitPrice: 1800,
      currency: 'LKR',
      effectiveFromUtc: '2026-10-07T00:00:00.000Z',
    };
    const updateRequest = {
      description: 'Complete blood count',
      unitPrice: 2000,
      currency: 'LKR',
      effectiveFromUtc: '2027-01-01T00:00:00.000Z',
    };
    post.mockResolvedValueOnce({ data: { tariffId: 'tariff-1' } });
    put.mockResolvedValueOnce({ data: { tariffId: 'tariff-2' } });
    remove.mockResolvedValueOnce({});

    await serviceTariffApi.create(createRequest);
    await serviceTariffApi.updatePrice('tariff-1', updateRequest);
    await serviceTariffApi.deactivate('tariff-2');

    expect(post).toHaveBeenCalledWith('/billing/api/service-tariffs', createRequest);
    expect(put).toHaveBeenCalledWith('/billing/api/service-tariffs/tariff-1', updateRequest);
    expect(remove).toHaveBeenCalledWith('/billing/api/service-tariffs/tariff-2');
  });
});
