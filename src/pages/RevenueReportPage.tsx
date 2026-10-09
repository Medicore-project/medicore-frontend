import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { departmentsApi, type Department } from '../api/departments';
import {
  revenueReportsApi, type RevenueReportFilters, type RevenueReportResponse,
} from '../api/revenueReports';
import { extractErrorMessage } from '../utils/apiError';
import { triggerBrowserDownload } from '../utils/download';

type Form = { departmentId: string; paymentMethod: string; currency: string; from: string; to: string };
const emptyForm: Form = { departmentId: '', paymentMethod: '', currency: '', from: '', to: '' };
const methods = ['Cash', 'Card', 'Insurance'] as const;
const colors: Record<string, string> = { Cash: '#2879d0', Card: '#16a085', Insurance: '#e77a39' };

function apiFilters(form: Form): RevenueReportFilters {
  return {
    departmentId: form.departmentId || undefined,
    paymentMethod: form.paymentMethod || undefined,
    currency: form.currency.trim().toUpperCase() || undefined,
    from: form.from || undefined,
    to: form.to || undefined,
  };
}

const RevenueReportPage = () => {
  const [form, setForm] = useState<Form>(emptyForm);
  const [applied, setApplied] = useState<RevenueReportFilters>({});
  const [report, setReport] = useState<RevenueReportResponse | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [chartCurrency, setChartCurrency] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [departmentWarning, setDepartmentWarning] = useState(false);

  useEffect(() => {
    let active = true;
    void revenueReportsApi.get({})
      .then(result => {
        if (active) {
          setReport(result);
          setChartCurrency(result.totalsByCurrency[0]?.currency ?? '');
        }
      })
      .catch((cause: unknown) => { if (active) setError(extractErrorMessage(cause, 'Could not load the revenue report.')); })
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
      const result = await revenueReportsApi.get(filters);
      setApplied(filters);
      setReport(result);
      setChartCurrency(result.totalsByCurrency[0]?.currency ?? '');
    } catch (cause) {
      setError(extractErrorMessage(cause, 'Could not load the revenue report.'));
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    setForm(emptyForm);
    setLoading(true);
    setError(null);
    try {
      const result = await revenueReportsApi.get({});
      setApplied({});
      setReport(result);
      setChartCurrency(result.totalsByCurrency[0]?.currency ?? '');
    } catch (cause) {
      setError(extractErrorMessage(cause, 'Could not reset the revenue report.'));
    } finally {
      setLoading(false);
    }
  };

  const download = async (format: 'Csv' | 'Pdf') => {
    setExporting(true);
    setError(null);
    try {
      const name = applied.departmentId ? names.get(applied.departmentId) : undefined;
      const file = await revenueReportsApi.download(applied, format, name);
      triggerBrowserDownload(file.blob, file.fileName);
    } catch (cause) {
      setError(extractErrorMessage(cause, `Could not export ${format.toUpperCase()}.`));
    } finally {
      setExporting(false);
    }
  };

  const breakdown = report?.breakdown.filter(row => row.currency === chartCurrency) ?? [];
  const departmentChart = Array.from(
    breakdown.reduce((map, row) => {
      const key = row.departmentId ?? '__unassigned';
      const data = map.get(key) ?? { name: departmentName(row.departmentId), Cash: 0, Card: 0, Insurance: 0 };
      if (row.paymentMethod === 'Cash' || row.paymentMethod === 'Card' || row.paymentMethod === 'Insurance')
        data[row.paymentMethod] += row.amount;
      map.set(key, data);
      return map;
    }, new Map<string, { name: string; Cash: number; Card: number; Insurance: number }>()),
  ).map(([, value]) => value);
  const dailyChart = report?.dailyTotals.filter(row => row.currency === chartCurrency)
    .map(row => ({ date: row.date, amount: row.amount })) ?? [];

  return (
    <div className="management-page revenue-page">
      <div className="page-header">
        <div>
          <h1>Revenue report</h1>
          <p className="page-subtitle">Payments received by department, method and Colombo date. Unpaid invoice balances are excluded.</p>
        </div>
        <div className="revenue-actions">
          <button type="button" className="btn btn-secondary" disabled={!report || exporting} onClick={() => void download('Csv')}>Export CSV</button>
          <button type="button" className="btn btn-secondary" disabled={!report || exporting} onClick={() => void download('Pdf')}>Export PDF</button>
        </div>
      </div>

      <form className="card revenue-filters" onSubmit={(event) => void submit(event)} aria-label="Revenue filters">
        <label>Department
          <select value={form.departmentId} onChange={event => setForm({ ...form, departmentId: event.target.value })}>
            <option value="">All departments</option>
            {departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
        </label>
        <label>Payment method
          <select value={form.paymentMethod} onChange={event => setForm({ ...form, paymentMethod: event.target.value })}>
            <option value="">All methods</option>
            {methods.map(method => <option key={method} value={method}>{method}</option>)}
          </select>
        </label>
        <label>Currency
          <input value={form.currency} maxLength={3} pattern="[A-Za-z]{3}" placeholder="All currencies" onChange={event => setForm({ ...form, currency: event.target.value })} />
        </label>
        <label>From
          <input type="date" min="1900-01-01" max="2100-12-31" value={form.from} onChange={event => setForm({ ...form, from: event.target.value })} />
        </label>
        <label>To
          <input type="date" min="1900-01-01" max="2100-12-31" value={form.to} onChange={event => setForm({ ...form, to: event.target.value })} />
        </label>
        <div className="revenue-filter-actions">
          <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => void reset()}>Reset</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>Apply filters</button>
        </div>
      </form>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {departmentWarning && <div className="alert" role="status">Department names are unavailable; IDs are shown instead.</div>}
      {loading && <div className="card revenue-loading" role="status">Preparing revenue report…</div>}
      {report && !loading && <>
        <p className="revenue-period">{report.appliedFilters.from} to {report.appliedFilters.to} (Asia/Colombo)
          {report.appliedFilters.isDefaultPeriod ? ' · Current month' : ''}</p>
        {report.totalsByCurrency.length === 0 ? (
          <div className="card revenue-empty">No payments match these filters.</div>
        ) : <>
          <section className="revenue-totals" aria-label="Revenue totals">
            {report.totalsByCurrency.map(total => <article className="card revenue-total" key={total.currency}>
              <span>{total.currency} received</span>
              <strong>{total.amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              <small>{total.paymentCount.toLocaleString()} payments</small>
            </article>)}
          </section>
          <div className="revenue-chart-switch">
            <label>Chart currency <select value={chartCurrency} onChange={event => setChartCurrency(event.target.value)}>
              {report.totalsByCurrency.map(total => <option key={total.currency} value={total.currency}>{total.currency}</option>)}
            </select></label>
          </div>
          <div className="revenue-chart-grid">
            <section className="card revenue-chart-card" aria-label="Revenue by department chart">
              <h2>By department</h2>
              <div className="revenue-chart" role="img" aria-label="Stacked revenue by department and payment method">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentChart} layout="vertical" margin={{ top: 8, right: 12, bottom: 5, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={120} />
                    <Tooltip /><Legend />
                    {methods.map(method => <Bar key={method} dataKey={method} stackId="revenue" fill={colors[method]} isAnimationActive={false} />)}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="card revenue-chart-card" aria-label="Daily revenue chart">
              <h2>Daily revenue</h2>
              <div className="revenue-chart" role="img" aria-label="Revenue received by Colombo date">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyChart} margin={{ top: 8, right: 18, bottom: 5, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip />
                    <Line type="monotone" dataKey="amount" name={chartCurrency} stroke="#2879d0" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
          <section className="card table-card revenue-table-card" aria-label="Revenue breakdown">
            <h2>Department and payment method</h2>
            <div className="table-responsive"><table className="data-table">
              <thead><tr><th>Department</th><th>Method</th><th>Currency</th><th className="num">Payments</th><th className="num">Amount received</th></tr></thead>
              <tbody>{report.breakdown.map(row => <tr key={`${row.departmentId}-${row.paymentMethod}-${row.currency}`}>
                <td>{departmentName(row.departmentId)}</td><td>{row.paymentMethod}</td><td>{row.currency}</td>
                <td className="num">{row.paymentCount.toLocaleString()}</td>
                <td className="num">{row.amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>)}</tbody>
            </table></div>
          </section>
        </>}
      </>}
    </div>
  );
};

export default RevenueReportPage;
