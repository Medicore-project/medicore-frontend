import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationLog, NotificationTemplate } from '../api/notifications';
import NotificationsPage from './NotificationsPage';

const api = vi.hoisted(() => ({
  listTemplates: vi.fn(),
  listLogs: vi.fn(),
  updateTemplate: vi.fn(),
  deactivateTemplate: vi.fn(),
}));

vi.mock('../api/notifications', () => ({ notificationsApi: api }));

const template: NotificationTemplate = {
  notificationTemplateId: 'template-1',
  code: 'PATIENT_WELCOME',
  name: 'Patient welcome',
  subjectTemplate: 'Welcome {{patientName}}',
  bodyTemplate: 'Hello {{patientName}}',
  isActive: true,
  createdAtUtc: '2026-10-08T08:00:00Z',
  updatedAtUtc: null,
};

const log: NotificationLog = {
  notificationLogId: 'log-1',
  sourceMessageId: 'message-1',
  eventType: 'patient.registered',
  templateCode: 'PATIENT_WELCOME',
  recipient: 'patient@example.com',
  subject: 'Welcome Patient',
  status: 'Sent',
  attemptCount: 1,
  error: null,
  createdAtUtc: '2026-10-08T08:00:00Z',
  lastAttemptAtUtc: '2026-10-08T08:00:01Z',
  sentAtUtc: '2026-10-08T08:00:01Z',
};

describe('NotificationsPage (SCRUM-46)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listTemplates.mockResolvedValue([template]);
    api.listLogs.mockResolvedValue([log]);
  });

  it('shows notification templates and delivery history', async () => {
    render(<NotificationsPage />);

    expect(await screen.findByText('Patient welcome')).toBeInTheDocument();
    expect(screen.getByText('patient.registered')).toBeInTheDocument();
    expect(screen.getByText('patient@example.com')).toBeInTheDocument();
    expect(screen.getAllByText('Sent').length).toBeGreaterThan(0);
  });

  it('offers no way to add a template, only to edit the ones the service sends', async () => {
    render(<NotificationsPage />);
    await screen.findByText('Patient welcome');

    expect(screen.queryByRole('button', { name: /add template/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('edits a template without letting its code change, and refreshes the page', async () => {
    api.updateTemplate.mockResolvedValue({ ...template, subjectTemplate: 'A new subject' });
    render(<NotificationsPage />);
    await screen.findByText('Patient welcome');

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Code')).toHaveValue('PATIENT_WELCOME');
    expect(screen.getByLabelText('Code')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: '  A new subject  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save template' }));

    await waitFor(() => expect(api.updateTemplate).toHaveBeenCalledWith('template-1', {
      name: 'Patient welcome',
      subjectTemplate: 'A new subject',
      bodyTemplate: 'Hello {{patientName}}',
      isActive: true,
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('PATIENT_WELCOME was updated.');
    expect(api.listTemplates).toHaveBeenCalledTimes(2);
  });
});
