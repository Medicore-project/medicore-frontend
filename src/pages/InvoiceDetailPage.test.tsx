import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InvoiceResponse } from '../api/billing';
import InvoiceDetailPage from './InvoiceDetailPage';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  recordPayment: vi.fn(),
}));

vi.mock('../api/billing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/billing')>()),
  invoiceApi: api,
}));

function invoice(overrides: Partial<InvoiceResponse> = {}): InvoiceResponse {
  return {
    invoiceId: 'invoice-1',
    invoiceNumber: 'INV-20261006-000001',
    appointmentId: 'appointment-1',
    patientId: 'patient-1',
    serviceCode: 'GEN-CONSULT',
    status: 'Payable',
    currency: 'LKR',
    subtotal: 2500,
    total: 2500,
    amountPaid: 500,
    balanceDue: 2000,
    requiresManualPricing: false,
    pricingIssue: null,
    issuedAtUtc: '2026-10-06T03:30:00Z',
    finalizedAtUtc: '2026-10-06T04:00:00Z',
    voidedAtUtc: null,
    voidReason: null,
    paidAtUtc: null,
    lines: [{
      invoiceLineId: 'line-1',
      tariffId: 'tariff-1',
      serviceCode: 'GEN-CONSULT',
      description: 'General consultation',
      quantity: 1,
      unitPrice: 2500,
      lineTotal: 2500,
    }],
    payments: [{
      paymentId: 'payment-1',
      amount: 500,
      method: 'Cash',
      recordedAtUtc: '2026-10-06T04:30:00Z',
      recordedBy: 'desk@medicore.lk',
    }],
    ...overrides,
  };
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/billing/invoices/invoice-1']}>
      <Routes>
        <Route path="/billing/invoices/:invoiceId" element={<InvoiceDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('InvoiceDetailPage (SCRUM-44)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue(invoice());
  });

  it('shows the balance, invoice lines and payment history', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'INV-20261006-000001' })).toBeInTheDocument();
    expect(screen.getByText('General consultation')).toBeInTheDocument();
    expect(screen.getByText('desk@medicore.lk', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('Amount (LKR)')).toHaveValue(2000);
    expect(api.get).toHaveBeenCalledWith('invoice-1');
  });

  it('records a partial payment and refreshes the history and balance from the response', async () => {
    api.recordPayment.mockResolvedValue(invoice({
      amountPaid: 1000,
      balanceDue: 1500,
      payments: [
        ...invoice().payments,
        {
          paymentId: 'payment-2',
          amount: 500,
          method: 'Card',
          recordedAtUtc: '2026-10-06T05:00:00Z',
          recordedBy: 'desk@medicore.lk',
        },
      ],
    }));
    renderPage();
    await screen.findByRole('heading', { name: 'INV-20261006-000001' });

    fireEvent.change(screen.getByLabelText('Amount (LKR)'), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText('Method'), { target: { value: 'Card' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));

    await waitFor(() => expect(api.recordPayment).toHaveBeenCalledWith('invoice-1', 500, 'Card'));
    expect(await screen.findByRole('status')).toHaveTextContent('Partial payment recorded.');
    expect(within(screen.getByRole('region', { name: 'Payment history' })).getByText('Card')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount (LKR)')).toHaveValue(1500);
  });

  it('shows payment controls when automatic issuance changes a draft to payable', async () => {
    api.get.mockResolvedValueOnce(invoice({
      status: 'Draft', amountPaid: 0, balanceDue: 2500, payments: [], finalizedAtUtc: null,
    })).mockResolvedValueOnce(invoice({
      status: 'Payable', amountPaid: 0, balanceDue: 2500, payments: [],
    }));
    renderPage();
    await screen.findByText('Payments are unavailable while this invoice is Draft.');

    expect(await screen.findByLabelText('Amount (LKR)', {}, { timeout: 6500 })).toHaveValue(2500);
    expect(api.get).toHaveBeenCalledTimes(2);
  }, 8000);
});
