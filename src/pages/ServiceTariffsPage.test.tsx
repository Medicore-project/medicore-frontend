import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceTariff } from '../api/serviceTariffs';
import ServiceTariffsPage from './ServiceTariffsPage';

const state = vi.hoisted(() => ({
  role: 'Admin',
  api: {
    list: vi.fn(),
    create: vi.fn(),
    updatePrice: vi.fn(),
    deactivate: vi.fn(),
  },
}));

vi.mock('../api/serviceTariffs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/serviceTariffs')>()),
  serviceTariffApi: state.api,
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role: state.role } }),
}));

const current: ServiceTariff = {
  tariffId: 'tariff-current',
  serviceCode: 'GEN-CONSULT',
  description: 'General consultation',
  unitPrice: 2500,
  currency: 'LKR',
  effectiveFromUtc: '2026-01-01T00:00:00Z',
  effectiveToUtc: null,
  isActive: true,
};

const previous: ServiceTariff = {
  ...current,
  tariffId: 'tariff-old',
  unitPrice: 2000,
  effectiveFromUtc: '2025-01-01T00:00:00Z',
  effectiveToUtc: '2026-01-01T00:00:00Z',
};

describe('ServiceTariffsPage (SCRUM-45)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.role = 'Admin';
    state.api.list.mockResolvedValue([current, previous]);
    state.api.updatePrice.mockResolvedValue({ ...current, tariffId: 'tariff-next' });
    state.api.deactivate.mockResolvedValue(undefined);
  });

  it('shows current pricing and its effective-dated history', async () => {
    render(<ServiceTariffsPage />);

    expect(await screen.findAllByText('GEN-CONSULT')).toHaveLength(2);
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('Superseded')).toBeInTheDocument();
    expect(state.api.list).toHaveBeenCalledWith(true);
  });

  it('schedules a new price version instead of editing the current row', async () => {
    render(<ServiceTariffsPage />);
    await screen.findByText('Current');

    fireEvent.click(screen.getByRole('button', { name: 'Update price' }));
    fireEvent.change(screen.getByLabelText('Unit price'), { target: { value: '3000' } });
    fireEvent.change(screen.getByLabelText('Effective from'), { target: { value: '2027-01-01T00:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Schedule new price' }));

    await waitFor(() => expect(state.api.updatePrice).toHaveBeenCalledWith(
      'tariff-current',
      expect.objectContaining({
        unitPrice: 3000,
        effectiveFromUtc: new Date('2027-01-01T00:00').toISOString(),
      }),
    ));
    expect(await screen.findByRole('status')).toHaveTextContent('new price version');
  });

  it('is read-only for a receptionist', async () => {
    state.role = 'Receptionist';
    render(<ServiceTariffsPage />);

    await screen.findByText('Current');
    expect(screen.queryByRole('button', { name: 'Update price' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Add tariff' })).not.toBeInTheDocument();
  });
});
