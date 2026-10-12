import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  specializations: {
    list: vi.fn(),
  },
}));

vi.mock('../api/serviceTariffs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/serviceTariffs')>()),
  serviceTariffApi: state.api,
}));

vi.mock('../api/specializations', () => ({
  specializationsApi: state.specializations,
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

const cardiology: ServiceTariff = {
  ...current,
  tariffId: 'tariff-cardiology',
  serviceCode: 'SPEC-CARDIOLOGY',
  description: 'Cardiology consultation',
  unitPrice: 7500,
};

describe('ServiceTariffsPage (SCRUM-45)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.role = 'Admin';
    state.api.list.mockResolvedValue([current, previous]);
    state.api.create.mockResolvedValue(cardiology);
    state.api.updatePrice.mockResolvedValue({ ...current, tariffId: 'tariff-next' });
    state.api.deactivate.mockResolvedValue(undefined);
    state.specializations.list.mockResolvedValue([
      { id: 's-1', name: 'Cardiology', isActive: true },
      { id: 's-2', name: 'Ear, Nose & Throat', isActive: true },
    ]);
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

  // ── A tariff belongs to a specialization ────────────────────────────────────

  it('creates a new tariff for the chosen specialization, under that specialization\'s code', async () => {
    render(<ServiceTariffsPage />);
    await screen.findByText('Current');

    fireEvent.click(screen.getByRole('button', { name: '+ Add tariff' }));
    fireEvent.change(await screen.findByLabelText('Specialization'), {
      target: { value: 'Ear, Nose & Throat' },
    });

    // The code is derived, never typed: it is what ties the tariff to bookings with those doctors.
    expect(screen.getByTestId('tariff-specialization-help')).toHaveTextContent('SPEC-EAR-NOSE-THROAT');
    expect(screen.queryByLabelText('Service code')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toHaveValue('Ear, Nose & Throat consultation');

    fireEvent.change(screen.getByLabelText('Unit price'), { target: { value: '6000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save tariff' }));

    await waitFor(() => expect(state.api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceCode: 'SPEC-EAR-NOSE-THROAT',
        description: 'Ear, Nose & Throat consultation',
        unitPrice: 6000,
        currency: 'LKR',
      }),
    ));
    expect(await screen.findByRole('status')).toHaveTextContent('Ear, Nose & Throat');
  });

  it('keeps a description the admin typed when the specialization is changed', async () => {
    render(<ServiceTariffsPage />);
    await screen.findByText('Current');

    fireEvent.click(screen.getByRole('button', { name: '+ Add tariff' }));
    fireEvent.change(await screen.findByLabelText('Specialization'), { target: { value: 'Cardiology' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Heart clinic visit' } });
    fireEvent.change(screen.getByLabelText('Specialization'), { target: { value: 'Ear, Nose & Throat' } });

    expect(screen.getByLabelText('Description')).toHaveValue('Heart clinic visit');
  });

  it('will not save a tariff that is not for any specialization', async () => {
    render(<ServiceTariffsPage />);
    await screen.findByText('Current');

    fireEvent.click(screen.getByRole('button', { name: '+ Add tariff' }));
    await screen.findByLabelText('Specialization');
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Something' } });
    fireEvent.change(screen.getByLabelText('Unit price'), { target: { value: '6000' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save tariff' }).closest('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('Choose the specialization');
    expect(state.api.create).not.toHaveBeenCalled();
  });

  it('does not offer a specialization that already has a tariff', async () => {
    state.api.list.mockResolvedValue([current, cardiology]);
    render(<ServiceTariffsPage />);
    await screen.findByText('SPEC-CARDIOLOGY');

    fireEvent.click(screen.getByRole('button', { name: '+ Add tariff' }));
    const select = await screen.findByLabelText('Specialization');

    expect(within(select).getByRole('option', { name: 'Cardiology (already has a tariff)' })).toBeDisabled();
    expect(within(select).getByRole('option', { name: 'Ear, Nose & Throat' })).toBeEnabled();
  });

  it('says in words whose visits each tariff prices', async () => {
    state.api.list.mockResolvedValue([
      current,
      cardiology,
      { ...current, tariffId: 'tariff-default', serviceCode: 'SPEC-CONSULT' },
      { ...current, tariffId: 'tariff-orphan', serviceCode: 'SPEC-RETIRED', isActive: false },
    ]);
    render(<ServiceTariffsPage />);

    const row = (code: string) => screen.getByText(code).closest('tr')!;
    await screen.findByText('SPEC-CARDIOLOGY');

    expect(row('GEN-CONSULT')).toHaveTextContent('Doctors with no specialization');
    expect(row('SPEC-CONSULT')).toHaveTextContent('Any specialization without its own tariff');
    await waitFor(() => expect(within(row('SPEC-CARDIOLOGY')).getByText('Cardiology')).toBeInTheDocument());
    expect(row('SPEC-RETIRED')).toHaveTextContent('No matching specialization');
  });

  it('still shows the catalogue when specializations cannot be loaded', async () => {
    state.specializations.list.mockRejectedValue(new Error('offline'));
    render(<ServiceTariffsPage />);

    expect(await screen.findByText('Current')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+ Add tariff' }));

    expect(await screen.findByTestId('tariff-specialization-help')).toHaveTextContent(
      'Could not load specializations',
    );
  });
});
