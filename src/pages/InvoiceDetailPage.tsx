import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  invoiceApi,
  type InvoiceResponse,
  type PaymentMethod,
} from '../api/billing';
import { extractErrorMessage } from '../utils/apiError';

const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'Card', 'Insurance'];

function dateTimeLabel(value: string): string {
  return new Intl.DateTimeFormat('en-LK', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Colombo',
  }).format(new Date(value));
}

function money(value: number, currency: string): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

const InvoiceDetailPage: React.FC = () => {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [invoice, setInvoice] = useState<InvoiceResponse | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('Cash');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceId) return;
    let cancelled = false;
    void invoiceApi
      .get(invoiceId)
      .then((found) => {
        if (!cancelled) {
          setInvoice(found);
          if (found.status === 'Payable' && found.balanceDue > 0) {
            setAmount(found.balanceDue.toFixed(2));
          }
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(extractErrorMessage(err, 'Could not load this invoice.'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  const suggestedAmount = useMemo(
    () => (invoice && invoice.balanceDue > 0 ? invoice.balanceDue.toFixed(2) : ''),
    [invoice],
  );

  const recordPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!invoice) return;
    const parsedAmount = Number(amount || suggestedAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter a payment amount greater than zero.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await invoiceApi.recordPayment(invoice.invoiceId, parsedAmount, method);
      setInvoice(updated);
      setAmount(updated.status === 'Payable' && updated.balanceDue > 0 ? updated.balanceDue.toFixed(2) : '');
      setSuccess(updated.status === 'Paid' ? 'Payment recorded. The invoice is now paid.' : 'Partial payment recorded.');
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not record the payment.'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="management-page billing-page"><p>Loading invoice…</p></div>;
  }

  if (!invoice) {
    return (
      <div className="management-page billing-page">
        <div className="alert alert-danger" role="alert">{error ?? 'Invoice not found.'}</div>
      </div>
    );
  }

  const canPay = invoice.status === 'Payable' && invoice.balanceDue > 0;

  return (
    <div className="management-page billing-page">
      <div className="page-header billing-header">
        <div>
          <Link className="profile-breadcrumb" to={`/appointments/${invoice.appointmentId}`}>
            Appointment
          </Link>
          <h1>{invoice.invoiceNumber}</h1>
          <p className="page-subtitle">Issued {dateTimeLabel(invoice.issuedAtUtc)}</p>
        </div>
        <span className={`billing-status billing-status--${invoice.status.toLowerCase()}`}>
          {invoice.status}
        </span>
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {success && <div className="alert alert-success" role="status">{success}</div>}
      {invoice.requiresManualPricing && (
        <div className="alert alert-danger" role="alert">
          {invoice.pricingIssue ?? 'This invoice requires manual pricing.'}
        </div>
      )}

      <div className="billing-summary-grid" aria-label="Invoice totals">
        <div className="billing-summary-card"><span>Total</span><strong>{money(invoice.total, invoice.currency)}</strong></div>
        <div className="billing-summary-card"><span>Paid</span><strong>{money(invoice.amountPaid, invoice.currency)}</strong></div>
        <div className="billing-summary-card billing-summary-card--balance"><span>Balance due</span><strong>{money(invoice.balanceDue, invoice.currency)}</strong></div>
      </div>

      <div className="billing-layout">
        <div className="billing-column">
          <section className="detail-card" aria-label="Invoice lines">
            <h2 className="detail-section-title">Invoice lines</h2>
            <div className="billing-table-scroll">
              <table className="billing-table">
                <thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead>
                <tbody>
                  {invoice.lines.map((line) => (
                    <tr key={line.invoiceLineId}>
                      <td><strong>{line.description}</strong><small>{line.serviceCode}</small></td>
                      <td>{line.quantity}</td>
                      <td>{line.unitPrice == null ? 'Pending' : money(line.unitPrice, invoice.currency)}</td>
                      <td>{money(line.lineTotal, invoice.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="detail-card" aria-label="Payment history">
            <h2 className="detail-section-title">Payment history</h2>
            {invoice.payments.length === 0 ? (
              <p className="billing-empty">No payments have been recorded.</p>
            ) : (
              <div className="billing-payment-list">
                {invoice.payments.map((payment) => (
                  <div className="billing-payment" key={payment.paymentId}>
                    <div><strong>{payment.method}</strong><span>{dateTimeLabel(payment.recordedAtUtc)} · {payment.recordedBy}</span></div>
                    <strong>{money(payment.amount, invoice.currency)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="detail-card billing-payment-card" aria-label="Record payment">
          <h2 className="detail-section-title">Record payment</h2>
          {canPay ? (
            <form onSubmit={(event) => void recordPayment(event)}>
              <label htmlFor="payment-amount">Amount ({invoice.currency})</label>
              <input
                id="payment-amount"
                type="number"
                min="0.01"
                max={invoice.balanceDue}
                step="0.01"
                value={amount}
                placeholder={suggestedAmount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
              <label htmlFor="payment-method">Method</label>
              <select id="payment-method" value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
                {PAYMENT_METHODS.map((option) => <option key={option}>{option}</option>)}
              </select>
              <button className="btn btn-primary" type="submit" disabled={isSaving}>
                {isSaving ? 'Recording…' : 'Record payment'}
              </button>
            </form>
          ) : (
            <p className="billing-empty">
              {invoice.status === 'Paid' ? 'This invoice has been paid in full.' : `Payments are unavailable while this invoice is ${invoice.status}.`}
            </p>
          )}
          {invoice.voidReason && <p className="billing-void-reason"><strong>Void reason:</strong> {invoice.voidReason}</p>}
        </aside>
      </div>
    </div>
  );
};

export default InvoiceDetailPage;
