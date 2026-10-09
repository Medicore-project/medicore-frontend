import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationLog, NotificationTemplate } from '../api/notifications';
import NotificationsPage from './NotificationsPage';

const api = vi.hoisted(() => ({
  listTemplates: vi.fn(),
  listLogs: vi.fn(),
  createTemplate: vi.fn(),
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

  it('creates a template and refreshes the page', async () => {
    api.createTemplate.mockResolvedValue({ ...template, code: 'CUSTOM_NOTICE' });
    render(<NotificationsPage />);
    await screen.findByText('Patient welcome');

    fireEvent.click(screen.getByRole('button', { name: '+ Add template' }));
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'custom_notice' } });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Custom notice' } });
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'A subject' } });
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'A body' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save template' }));

    await waitFor(() => expect(api.createTemplate).toHaveBeenCalledWith({
      code: 'CUSTOM_NOTICE',
      name: 'Custom notice',
      subjectTemplate: 'A subject',
      bodyTemplate: 'A body',
    }));
    expect(api.listTemplates).toHaveBeenCalledTimes(2);
  });
});
