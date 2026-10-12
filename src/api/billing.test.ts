import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from './client';
import { invoiceApi } from './billing';

vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);

describe('invoiceApi (SCRUM-44)', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPost.mockReset();
  });

  it('loads the invoice associated with an appointment', async () => {
    mockedGet.mockResolvedValueOnce({ data: { invoiceId: 'invoice-1' } });

    const result = await invoiceApi.getByAppointment('appointment-1');

    expect(mockedGet).toHaveBeenCalledWith(
      '/billing/api/invoices/by-appointment/appointment-1',
    );
    expect(result).toEqual({ invoiceId: 'invoice-1' });
  });

  it('records the amount and supported payment method', async () => {
    mockedPost.mockResolvedValueOnce({ data: { status: 'Paid' } });

    const result = await invoiceApi.recordPayment('invoice-1', 2500, 'Card');

    expect(mockedPost).toHaveBeenCalledWith('/billing/api/invoices/invoice-1/payments', {
      amount: 2500,
      method: 'Card',
    });
    expect(result).toEqual({ status: 'Paid' });
  });
});
