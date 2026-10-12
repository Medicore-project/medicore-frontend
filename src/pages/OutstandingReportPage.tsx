import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { departmentsApi, type Department } from '../api/departments';
import {
  outstandingReportsApi, type OutstandingReportFilters, type OutstandingReportResponse,
} from '../api/outstandingReports';
import { extractErrorMessage } from '../utils/apiError';
import { triggerBrowserDownload } from '../utils/download';

type Form = { departmentId: string; currency: string; from: string; to: string };
const emptyForm: Form = { departmentId: '', currency: '', from: '', to: '' };
const bucketOrder = ['0-30', '31-60', '61-90', '91+'];

function apiFilters(form: Form): OutstandingReportFilters {
  return {
    departmentId: form.departmentId || undefined,
    currency: form.currency.trim().toUpperCase() || undefined,
    from: form.from || undefined,
    to: form.to || undefined,
  };
}

const OutstandingReportPage = () => {
  const [form, setForm] = useState<Form>(emptyForm);
  const [applied, setApplied] = useState<OutstandingReportFilters>({});
  const [report, setReport] = useState<OutstandingReportResponse | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [chartCurrency, setChartCurrency] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [departmentWarning, setDepartmentWarning] = useState(false);

  useEffect(() => {
    let active = true;
    void outstandingReportsApi.get({})
      .then(result => {
        if (active) {
          setReport(result);
          setChartCurrency(result.totalsByCurrency[0]?.currency ?? '');
        }
      })
      .catch((cause: unknown) => { if (active) setError(extractErrorMessage(cause, 'Could not load outstanding invoices.')); })
      .finally(() => { if (active) setLoading(false); });
    void departmentsApi.list()
      .then(found => { if (active) setDepartments(found); })
      .catch(() => { if (active) setDepartmentWarning(true); });
    return () => { active = false; };
  }, []);

  const names = useMemo(() => new Map(departments.map(department => [String(department.id), department.name])), [departments]);
  const departmentName = (id: string | null) => id === null
    ? 'Unassigned (legacy booking)'
    : names.get(id) ?? id;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.from && form.to && form.from > form.to) {
      setError('To date must be on or after from date.');
      return;
    }
    if (form.from && form.to &&
        (Date.parse(`${form.to}T00:00:00Z`) - Date.parse(`${form.from}T00:00:00Z`)) / 86_400_000 + 1 > 366) {
      setError('Period cannot exceed 366 days.');
      return;
    }
    const filters = apiFilters(form);
    setLoading(true);
    setError(null);
    try {
      const result = await outstandingReportsApi.get(filters);
      setApplied(filters);
      setReport(result);
      setChartCurrency(result.totalsByCurrency[0]?.currency ?? '');
    } catch (cause) {
      setError(extractErrorMessage(cause, 'Could not load outstanding invoices.'));
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    setForm(emptyForm);
    setLoading(true);
    setError(null);
    try {
      const result = await outstandingReportsApi.get({});
      setApplied({});
      setReport(result);
      setChartCurrency(result.totalsByCurrency[0]?.currency ?? '');
    } catch (cause) {
      setError(extractErrorMessage(cause, 'Could not reset outstanding invoices.'));
    } finally {
      setLoading(false);
    }
  };

  const download = async (format: 'Csv' | 'Pdf') => {
    setExporting(true);
    setError(null);
    try {
      const name = applied.departmentId ? names.get(applied.departmentId) : undefined;
      const file = await outstandingReportsApi.download(applied, format, name);
      triggerBrowserDownload(file.blob, file.fileName);
    } catch (cause) {
      setError(extractErrorMessage(cause, `Could not export ${format.toUpperCase()}.`));
    } finally {
      setExporting(false);
    }
  };

  const chartData = bucketOrder.map(bucket => ({
    bucket,
    amount: report?.buckets.filter(row => row.currency === chartCurrency && row.bucket === bucket)
      .reduce((sum, row) => sum + row.balanceDue, 0) ?? 0,
  }));
  const visibleBuckets = report?.buckets.filter(row => row.currency === chartCurrency) ?? [];
  const money = (amount: number, currency: string) => `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="management-page revenue-page outstanding-page">
      <div className="page-header">
        <div>
          <h1>Outstanding invoice report</h1>
          <p className="page-subtitle">Current balances on payable invoices, aged from the day each became payable. Drafts and voided invoices are excluded.</p>
        </div>
        <div className="revenue-actions">
          <button type="button" className="btn btn-secondary" disabled={!report || exporting} onClick={() => void download('Csv')}>Export CSV</button>
          <button type="button" className="btn btn-secondary" disabled={!report || exporting} onClick={() => void download('Pdf')}>Export PDF</button>
        </div>
      </div>

      <form className="card revenue-filters" onSubmit={(event) => void submit(event)} aria-label="Outstanding invoice filters">
        <label>Department
          <select value={form.departmentId} onChange={event => setForm({ ...form, departmentId: event.target.value })}>
            <option value="">All departments</option>
            {departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
        </label>
        <label>Currency
          <input value={form.currency} maxLength={3} pattern="[A-Za-z]{3}" placeholder="All currencies" onChange={event => setForm({ ...form, currency: event.target.value })} />
        </label>
        <label>Issued from
          <input type="date" min="1900-01-01" max="2100-12-31" value={form.from} onChange={event => setForm({ ...form, from: event.target.value })} />
        </label>
        <label>Issued to
          <input type="date" min="1900-01-01" max="2100-12-31" value={form.to} onChange={event => setForm({ ...form, to: event.target.value })} />
        </label>
        <div className="revenue-filter-actions">
          <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => void reset()}>Reset</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>Apply filters</button>
        </div>
      </form>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {departmentWarning && <div className="alert" role="status">Department names are unavailable; IDs are shown instead.</div>}
      {loading && <div className="card revenue-loading" role="status">Preparing outstanding invoice report…</div>}
      {report && !loading && <>
        <p className="revenue-period">Balances as of {report.appliedFilters.asOf} (Asia/Colombo). Issue date filters select invoices; ageing and balances are current.</p>
        {report.invoices.length === 0 ? <div className="card revenue-empty">No outstanding invoices match these filters.</div> : <>
          <section className="revenue-totals" aria-label="Outstanding totals">
            {report.totalsByCurrency.map(total => <article className="card revenue-total" key={total.currency}>
              <span>{total.currency} outstanding</span>
              <strong>{money(total.balanceDue, total.currency)}</strong>
              <small>{total.invoiceCount} invoice{total.invoiceCount === 1 ? '' : 's'}</small>
            </article>)}
          </section>
          {report.totalsByCurrency.length > 1 && <div className="revenue-chart-switch">
            <label>Chart currency
              <select value={chartCurrency} onChange={event => setChartCurrency(event.target.value)}>
                {report.totalsByCurrency.map(total => <option key={total.currency} value={total.currency}>{total.currency}</option>)}
              </select>
            </label>
          </div>}
          <section className="card revenue-chart-card" aria-label="Outstanding ageing chart">
            <h2>Ageing by days payable ({chartCurrency})</h2>
            <div className="revenue-chart" role="img" aria-label="Outstanding balance by ageing bucket">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 5, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" />
                  <YAxis />
                  <Tooltip formatter={(value) => money(Number(value), chartCurrency)} />
                  <Bar dataKey="amount" name="Balance due" fill="#2879d0" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="card revenue-table-card" aria-label="Ageing by department">
            <h2>Ageing by department ({chartCurrency})</h2>
            <div className="table-responsive"><table><thead><tr><th>Department</th><th>Days payable</th><th>Invoices</th><th>Balance due</th></tr></thead>
              <tbody>{visibleBuckets.map(row => <tr key={`${row.departmentId ?? 'none'}-${row.currency}-${row.bucket}`}>
                <td>{departmentName(row.departmentId)}</td><td>{row.bucket}</td><td>{row.invoiceCount}</td><td>{money(row.balanceDue, row.currency)}</td>
              </tr>)}</tbody></table></div>
          </section>
          <section className="card revenue-table-card" aria-label="Unpaid invoices">
            <h2>Unpaid invoices</h2>
            <div className="table-responsive"><table><thead><tr><th>Invoice</th><th>Department</th><th>Payable since</th><th>Days</th><th>Total</th><th>Paid</th><th>Balance due</th></tr></thead>
              <tbody>{report.invoices.map(invoice => <tr key={invoice.invoiceId}>
                <td><Link to={`/billing/invoices/${invoice.invoiceId}`}>{invoice.invoiceNumber}</Link></td>
                <td>{departmentName(invoice.departmentId)}</td><td>{invoice.finalizedDate}</td><td>{invoice.ageDays}</td>
                <td>{money(invoice.total, invoice.currency)}</td><td>{money(invoice.amountPaid, invoice.currency)}</td>
                <td>{money(invoice.balanceDue, invoice.currency)}</td>
              </tr>)}</tbody></table></div>
          </section>
        </>}
      </>}
    </div>
  );
};

export default OutstandingReportPage;
