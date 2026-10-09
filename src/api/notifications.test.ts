import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from './client';
import { notificationsApi } from './notifications';

vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const client = vi.mocked(apiClient);

describe('notificationsApi (SCRUM-46)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads templates and recent delivery logs through the billing gateway', async () => {
    client.get.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: [] });

    await notificationsApi.listTemplates(true);
    await notificationsApi.listLogs(50);

    expect(client.get).toHaveBeenNthCalledWith(1, '/billing/api/notification-templates', {
      params: { includeInactive: true },
    });
    expect(client.get).toHaveBeenNthCalledWith(2, '/billing/api/notifications', {
      params: { limit: 50 },
    });
  });

  it('creates, updates and deactivates templates', async () => {
    const created = {
      notificationTemplateId: 'template-1',
      code: 'CUSTOM_NOTICE',
      name: 'Custom notice',
      subjectTemplate: 'Subject',
      bodyTemplate: 'Body',
      isActive: true,
      createdAtUtc: '2026-10-08T08:00:00Z',
      updatedAtUtc: null,
    };
    client.post.mockResolvedValue({ data: created });
    client.put.mockResolvedValue({ data: { ...created, name: 'Updated' } });
    client.delete.mockResolvedValue({ data: undefined });

    await notificationsApi.createTemplate({ code: 'CUSTOM_NOTICE', name: 'Custom notice', subjectTemplate: 'Subject', bodyTemplate: 'Body' });
    await notificationsApi.updateTemplate('template-1', { name: 'Updated', subjectTemplate: 'Subject', bodyTemplate: 'Body', isActive: true });
    await notificationsApi.deactivateTemplate('template-1');

    expect(client.post).toHaveBeenCalledWith('/billing/api/notification-templates', expect.objectContaining({ code: 'CUSTOM_NOTICE' }));
    expect(client.put).toHaveBeenCalledWith('/billing/api/notification-templates/template-1', expect.objectContaining({ name: 'Updated' }));
    expect(client.delete).toHaveBeenCalledWith('/billing/api/notification-templates/template-1');
  });
});
