import apiClient from './client';

export type InvoiceStatus = 'Draft' | 'Payable' | 'Paid' | 'Void';
export type PaymentMethod = 'Cash' | 'Card' | 'Insurance';

export interface InvoiceLineResponse {
  invoiceLineId: string;
  tariffId: string | null;
  serviceCode: string;
  description: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number;
}

export interface PaymentResponse {
  paymentId: string;
  amount: number;
  method: PaymentMethod;
  recordedAtUtc: string;
  recordedBy: string;
}

export interface InvoiceResponse {
  invoiceId: string;
  invoiceNumber: string;
  appointmentId: string;
  patientId: string;
  serviceCode: string;
  status: InvoiceStatus;
  currency: string;
  subtotal: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  requiresManualPricing: boolean;
  pricingIssue: string | null;
  issuedAtUtc: string;
  finalizedAtUtc: string | null;
  voidedAtUtc: string | null;
  voidReason: string | null;
  paidAtUtc: string | null;
  lines: InvoiceLineResponse[];
  payments: PaymentResponse[];
}

const invoicesPath = '/billing/api/invoices';

export const invoiceApi = {
  async get(invoiceId: string): Promise<InvoiceResponse> {
    const response = await apiClient.get<InvoiceResponse>(`${invoicesPath}/${invoiceId}`);
    return response.data;
  },

  async getByAppointment(appointmentId: string): Promise<InvoiceResponse> {
    const response = await apiClient.get<InvoiceResponse>(
      `${invoicesPath}/by-appointment/${appointmentId}`,
    );
    return response.data;
  },

  async recordPayment(
    invoiceId: string,
    amount: number,
    method: PaymentMethod,
  ): Promise<InvoiceResponse> {
    const response = await apiClient.post<InvoiceResponse>(`${invoicesPath}/${invoiceId}/payments`, {
      amount,
      method,
    });
    return response.data;
  },
};
