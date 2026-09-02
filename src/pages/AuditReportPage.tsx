import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { reportsApi, type AuditReportRow, type AuditReportParams } from '../api/reports';

const ACTION_TYPES = [
  'Login',
  'Logout',
  'Create',
  'Update',
  'Delete',
  'View',
  'AssignRole',
];

export const AuditReportPage: React.FC = () => {
  const [data, setData] = useState<AuditReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [actionType, setActionType] = useState('');

  const fetchReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: AuditReportParams = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (actionType) params.actionType = actionType;

      const result = await reportsApi.getAuditReport(params);
      setData(result);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to fetch audit report.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate, actionType]);

  const chartData = useMemo(() => {
    const countsByDate = data.reduce((acc, row) => {
      const date = new Date(row.timestamp).toLocaleDateString();
      if (!acc[date]) {
        acc[date] = 0;
      }
      acc[date]++;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(countsByDate)
      .map(([date, count]) => ({ date, actions: count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data]);

  return (
    <div className="management-page">
      <div className="page-header">
        <div>
          <h1>Audit Report</h1>
          <p className="page-subtitle">Review system activity and security events</p>
        </div>
      </div>

      <div className="card filter-bar">
        <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
          <label htmlFor="start-date" style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>Start Date</label>
          <input
            id="start-date"
            type="date"
            className="filter-search"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
          <label htmlFor="end-date" style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>End Date</label>
          <input
            id="end-date"
            type="date"
            className="filter-search"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
          <label htmlFor="action-type" style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>Action Type</label>
          <select
            id="action-type"
            className="filter-select"
            style={{ width: '100%' }}
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
          >
            <option value="">All Actions</option>
            {ACTION_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          <span>{error}</span>
          <button type="button" className="alert-close" onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="card" style={{ marginBottom: '24px', padding: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px', color: 'var(--text-main)' }}>Activity Overview (Actions per Day)</h2>
        <div style={{ width: '100%', height: 300 }}>
          {chartData.length > 0 ? (
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="actions" name="Number of Actions" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
             <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
               {isLoading ? 'Loading chart...' : 'No activity data for the selected period.'}
             </div>
          )}
        </div>
      </div>

      <div className="card table-card">
        {isLoading ? (
          <div className="table-loading">
            <div className="spinner" />
            <p>Loading audit log...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="table-empty">
            <p>No audit records found.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Details</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.id}>
                    <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>
                      {new Date(row.timestamp).toLocaleString()}
                    </td>
                    <td className="font-semibold">{row.userName} <span className="text-muted" style={{ fontWeight: 'normal', fontSize: '12px' }}>(#{row.userId})</span></td>
                    <td>
                      <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>
                        {row.actionType}
                      </span>
                    </td>
                    <td>{row.resourceName}</td>
                    <td className="text-muted" style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.details}>
                      {row.details || '—'}
                    </td>
                    <td className="text-muted">{row.ipAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditReportPage;
