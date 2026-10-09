import { useCallback, useEffect, useState } from 'react';
import {
  notificationsApi,
  type CreateNotificationTemplateRequest,
  type NotificationLog,
  type NotificationTemplate,
  type UpdateNotificationTemplateRequest,
} from '../api/notifications';
import { extractErrorMessage } from '../utils/apiError';

type TemplateForm = {
  code: string;
  name: string;
  subjectTemplate: string;
  bodyTemplate: string;
  isActive: boolean;
};

const emptyForm = (): TemplateForm => ({
  code: '',
  name: '',
  subjectTemplate: '',
  bodyTemplate: '',
  isActive: true,
});

function dateTimeLabel(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-LK', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Colombo',
  }).format(new Date(value));
}

const NotificationsPage = () => {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [foundTemplates, foundLogs] = await Promise.all([
        notificationsApi.listTemplates(true),
        notificationsApi.listLogs(100),
      ]);
      setTemplates(foundTemplates);
      setLogs(foundLogs);
    } catch (requestError) {
      setError(extractErrorMessage(requestError, 'Could not load notification settings.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- route mount must fetch server-owned templates and logs.
    void load();
  }, [load]);

  const startCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowForm(true);
    setError(null);
    setSuccess(null);
  };

  const startEdit = (template: NotificationTemplate) => {
    setEditing(template);
    setForm({
      code: template.code,
      name: template.name,
      subjectTemplate: template.subjectTemplate,
      bodyTemplate: template.bodyTemplate,
      isActive: template.isActive,
    });
    setShowForm(true);
    setError(null);
    setSuccess(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm());
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (editing) {
        const request: UpdateNotificationTemplateRequest = {
          name: form.name.trim(),
          subjectTemplate: form.subjectTemplate.trim(),
          bodyTemplate: form.bodyTemplate.trim(),
          isActive: form.isActive,
        };
        await notificationsApi.updateTemplate(editing.notificationTemplateId, request);
        setSuccess(`${editing.code} was updated.`);
      } else {
        const request: CreateNotificationTemplateRequest = {
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          subjectTemplate: form.subjectTemplate.trim(),
          bodyTemplate: form.bodyTemplate.trim(),
        };
        await notificationsApi.createTemplate(request);
        setSuccess(`${request.code} was created.`);
      }
      closeForm();
      await load();
    } catch (requestError) {
      setError(extractErrorMessage(requestError, 'Could not save the notification template.'));
    } finally {
      setIsSaving(false);
    }
  };

  const deactivate = async (template: NotificationTemplate) => {
    if (!window.confirm(`Deactivate ${template.code}? Events using it will retry and eventually enter the DLT.`)) return;
    setError(null);
    setSuccess(null);
    try {
      await notificationsApi.deactivateTemplate(template.notificationTemplateId);
      setSuccess(`${template.code} was deactivated.`);
      await load();
    } catch (requestError) {
      setError(extractErrorMessage(requestError, 'Could not deactivate the notification template.'));
    }
  };

  return (
    <div className="management-page notification-page">
      <div className="page-header">
        <div>
          <h1>Email notifications</h1>
          <p className="page-subtitle">Templates and delivery results for welcome, booking and payment emails.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={startCreate}>+ Add template</button>
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {success && <div className="alert alert-success" role="status">{success}</div>}

      {showForm && (
        <section className="card notification-form-card" aria-label="Notification template form">
          <div className="card-header"><h2>{editing ? `Edit ${editing.code}` : 'New notification template'}</h2></div>
          <form onSubmit={(event) => void save(event)}>
            <div className="notification-form-grid">
              <label>Code<input value={form.code} disabled={Boolean(editing)} required maxLength={80} pattern="[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*" onChange={(event) => setForm({ ...form, code: event.target.value })} /></label>
              <label>Name<input value={form.name} required maxLength={150} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label className="notification-wide">Subject<input value={form.subjectTemplate} required maxLength={300} onChange={(event) => setForm({ ...form, subjectTemplate: event.target.value })} /></label>
              <label className="notification-wide">Body<textarea value={form.bodyTemplate} required maxLength={10000} rows={6} onChange={(event) => setForm({ ...form, bodyTemplate: event.target.value })} /></label>
              {editing && <label className="notification-active"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Active</label>}
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={closeForm}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? 'Saving…' : 'Save template'}</button>
            </div>
          </form>
        </section>
      )}

      <section className="card table-card" aria-label="Notification templates">
        <div className="card-header"><h2>Templates</h2></div>
        {isLoading ? <p className="billing-empty">Loading notifications…</p> : (
          <div className="table-responsive">
            <table className="data-table">
              <thead><tr><th>Template</th><th>Subject</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{templates.map((template) => (
                <tr key={template.notificationTemplateId}>
                  <td><strong>{template.name}</strong><span className="notification-code">{template.code}</span></td>
                  <td>{template.subjectTemplate}</td>
                  <td><span className={`badge notification-status--${template.isActive ? 'sent' : 'failed'}`}>{template.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td><div className="action-buttons"><button className="btn btn-sm btn-outline" type="button" onClick={() => startEdit(template)}>Edit</button>{template.isActive && <button className="btn btn-sm btn-danger-outline" type="button" onClick={() => void deactivate(template)}>Deactivate</button>}</div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card table-card notification-log-card" aria-label="Notification delivery log">
        <div className="card-header"><h2>Recent delivery log</h2></div>
        <div className="table-responsive">
          <table className="data-table">
            <thead><tr><th>Created</th><th>Event</th><th>Recipient</th><th>Status</th><th>Attempts</th><th>Details</th></tr></thead>
            <tbody>{logs.length === 0 ? <tr><td colSpan={6}>No notifications have been processed.</td></tr> : logs.map((log) => (
              <tr key={log.notificationLogId}>
                <td>{dateTimeLabel(log.createdAtUtc)}</td>
                <td><strong>{log.eventType}</strong><span className="notification-code">{log.templateCode}</span></td>
                <td>{log.recipient}</td>
                <td><span className={`badge notification-status--${log.status.toLowerCase()}`}>{log.status}</span></td>
                <td>{log.attemptCount}</td>
                <td>{log.error ?? (log.sentAtUtc ? `Sent ${dateTimeLabel(log.sentAtUtc)}` : 'Queued')}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default NotificationsPage;
