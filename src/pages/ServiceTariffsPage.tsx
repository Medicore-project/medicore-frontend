import { useEffect, useMemo, useState } from 'react';
import {
  serviceTariffApi,
  type CreateServiceTariffRequest,
  type ServiceTariff,
  type UpdateServiceTariffRequest,
} from '../api/serviceTariffs';
import { specializationsApi, type Specialization } from '../api/specializations';
import { useAuth } from '../contexts/AuthContext';
import { extractErrorMessage } from '../utils/apiError';
import { canManageOrganization } from '../utils/permissions';
import {
  GENERAL_CONSULTATION,
  SPECIALIST_CONSULTATION,
  serviceCodeForSpecialization,
} from '../utils/serviceCodes';

type TariffForm = {
  /** The specialization a new tariff is for. Unused when changing a price: the code is kept. */
  specialization: string;
  serviceCode: string;
  description: string;
  unitPrice: string;
  currency: string;
  effectiveFrom: string;
};

function localDateTimeInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function initialForm(): TariffForm {
  return {
    specialization: '',
    serviceCode: '',
    description: '',
    unitPrice: '',
    currency: 'LKR',
    effectiveFrom: localDateTimeInput(new Date()),
  };
}

function suggestedDescription(specialization: string): string {
  return specialization ? `${specialization} consultation` : '';
}

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

function statusOf(tariff: ServiceTariff): 'Current' | 'Scheduled' | 'Superseded' | 'Inactive' {
  if (!tariff.isActive) return 'Inactive';
  const now = Date.now();
  if (new Date(tariff.effectiveFromUtc).getTime() > now) return 'Scheduled';
  if (tariff.effectiveToUtc && new Date(tariff.effectiveToUtc).getTime() <= now) return 'Superseded';
  return 'Current';
}

type SpecializationsState = 'loading' | 'ready' | 'failed';

/** Whose visits a tariff prices. The code alone does not say which doctors it covers. */
function appliesTo(
  serviceCode: string,
  specializationByCode: Map<string, string>,
  specializationsState: SpecializationsState,
): string {
  if (serviceCode === GENERAL_CONSULTATION) return 'Doctors with no specialization';
  if (serviceCode === SPECIALIST_CONSULTATION) return 'Any specialization without its own tariff';
  const specialization = specializationByCode.get(serviceCode);
  if (specialization) return specialization;
  // Only claim there is no match once the list it would be in has actually arrived.
  return specializationsState === 'ready' ? 'No matching specialization' : '—';
}

const ServiceTariffsPage = () => {
  const { user } = useAuth();
  const canManage = canManageOrganization(user?.role);
  const [tariffs, setTariffs] = useState<ServiceTariff[]>([]);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [specializationsState, setSpecializationsState] = useState<SpecializationsState>('loading');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<ServiceTariff | null>(null);
  const [form, setForm] = useState<TariffForm>(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const latestByCode = useMemo(() => {
    const latest = new Map<string, ServiceTariff>();
    tariffs.forEach((tariff) => {
      const existing = latest.get(tariff.serviceCode);
      if (!existing || new Date(tariff.effectiveFromUtc) > new Date(existing.effectiveFromUtc)) {
        latest.set(tariff.serviceCode, tariff);
      }
    });
    return latest;
  }, [tariffs]);

  // A tariff is tied to its specialization by the code both are named with, so each
  // specialization is offered once, and only while no tariff — active or not — holds its code:
  // the billing service refuses a second tariff for a code it has ever seen.
  const specializationOptions = useMemo(() => {
    const takenCodes = new Set(tariffs.map((tariff) => tariff.serviceCode));
    return [...specializations]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((specialization) => {
        const code = serviceCodeForSpecialization(specialization.name);
        return { id: String(specialization.id), name: specialization.name, code, taken: takenCodes.has(code) };
      });
  }, [specializations, tariffs]);

  const specializationByCode = useMemo(
    () => new Map(specializationOptions.map((option) => [option.code, option.name])),
    [specializationOptions],
  );

  const loadTariffs = async () => {
    setIsLoading(true);
    try {
      setTariffs(await serviceTariffApi.list(true));
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not load the service tariff catalogue.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void serviceTariffApi
      .list(true)
      .then((found) => {
        if (!cancelled) setTariffs(found);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(extractErrorMessage(err, 'Could not load the service tariff catalogue.'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    // Separate from the catalogue on purpose: the prices are still worth showing if this fails,
    // and only adding a tariff needs it.
    void specializationsApi
      .list()
      .then((found) => {
        if (cancelled) return;
        setSpecializations(found);
        setSpecializationsState('ready');
      })
      .catch(() => {
        if (!cancelled) setSpecializationsState('failed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const closeForm = () => {
    setIsAdding(false);
    setEditing(null);
    setForm(initialForm());
  };

  const startCreate = () => {
    setEditing(null);
    setForm(initialForm());
    setIsAdding(true);
    setError(null);
    setSuccess(null);
  };

  const startPriceChange = (tariff: ServiceTariff) => {
    const earliest = new Date(new Date(tariff.effectiveFromUtc).getTime() + 60_000);
    const suggested = earliest > new Date() ? earliest : new Date();
    setEditing(tariff);
    setIsAdding(false);
    setForm({
      specialization: '',
      serviceCode: tariff.serviceCode,
      description: tariff.description,
      unitPrice: tariff.unitPrice.toFixed(2),
      currency: tariff.currency,
      effectiveFrom: localDateTimeInput(suggested),
    });
    setError(null);
    setSuccess(null);
  };

  const chooseSpecialization = (name: string) => {
    // The description follows the specialization only while it is still the one suggested for
    // the previous choice, so anything the admin typed is left alone.
    const wasSuggested = form.description === suggestedDescription(form.specialization);
    setForm({
      ...form,
      specialization: name,
      serviceCode: name ? serviceCodeForSpecialization(name) : '',
      description: wasSuggested ? suggestedDescription(name) : form.description,
    });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing && !form.serviceCode) {
      setError('Choose the specialization this tariff is for.');
      return;
    }
    const price = Number(form.unitPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setError('Enter a unit price greater than zero.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const common: UpdateServiceTariffRequest = {
        description: form.description.trim(),
        unitPrice: price,
        currency: form.currency.trim().toUpperCase(),
        effectiveFromUtc: new Date(form.effectiveFrom).toISOString(),
      };
      if (editing) {
        await serviceTariffApi.updatePrice(editing.tariffId, common);
        setSuccess(`A new price version was scheduled for ${editing.serviceCode}.`);
      } else {
        const request: CreateServiceTariffRequest = {
          ...common,
          serviceCode: form.serviceCode,
        };
        await serviceTariffApi.create(request);
        setSuccess(`A tariff for ${form.specialization} (${request.serviceCode}) was added to the catalogue.`);
      }
      closeForm();
      await loadTariffs();
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not save the service tariff.'));
    } finally {
      setIsSaving(false);
    }
  };

  const deactivate = async (tariff: ServiceTariff) => {
    if (!window.confirm(`Deactivate ${tariff.serviceCode}? New appointments will no longer use this tariff.`)) return;
    setError(null);
    setSuccess(null);
    try {
      await serviceTariffApi.deactivate(tariff.tariffId);
      setSuccess(`${tariff.serviceCode} was deactivated. Existing invoices were not changed.`);
      await loadTariffs();
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not deactivate the service tariff.'));
    }
  };

  const specializationHelp = specializationsState === 'failed'
    ? 'Could not load specializations. Reload the page to add a tariff.'
    : specializationsState === 'loading'
      ? 'Loading specializations…'
      : specializations.length === 0
        ? 'No specializations exist yet. Add one on the Specializations page first.'
        : form.serviceCode
          ? `Service code: ${form.serviceCode}`
          : 'Each specialization has one tariff.';

  return (
    <div className="management-page tariff-page">
      <div className="page-header">
        <div>
          <h1>Service tariffs</h1>
          <p className="page-subtitle">Effective-dated prices, one per specialization, used when appointment invoices are issued.</p>
        </div>
        {canManage && !isAdding && !editing && (
          <button type="button" className="btn btn-primary" onClick={startCreate}>+ Add tariff</button>
        )}
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {success && <div className="alert alert-success" role="status">{success}</div>}

      {(isAdding || editing) && (
        <div className="card add-form-card">
          <div className="card-header">
            <h3>{editing ? `New price for ${editing.serviceCode}` : 'New service tariff'}</h3>
            {editing
              ? <p className="tariff-form-note">The current price remains in history and already-issued invoices stay unchanged.</p>
              : <p className="tariff-form-note">Appointments with a doctor of the chosen specialization are invoiced at this price.</p>}
          </div>
          <form className="inline-form" onSubmit={(event) => void save(event)}>
            <div className="tariff-form-grid">
              {editing ? (
                <div className="form-group">
                  <label htmlFor="tariff-code">Service code</label>
                  <input id="tariff-code" value={form.serviceCode} disabled />
                </div>
              ) : (
                <div className="form-group">
                  <label htmlFor="tariff-specialization">Specialization</label>
                  <select id="tariff-specialization" value={form.specialization} required
                    onChange={(event) => chooseSpecialization(event.target.value)}>
                    <option value="">-- Select Specialization --</option>
                    {specializationOptions.map((option) => (
                      <option key={option.id} value={option.name} disabled={option.taken}>
                        {option.taken ? `${option.name} (already has a tariff)` : option.name}
                      </option>
                    ))}
                  </select>
                  <p className="field-help" data-testid="tariff-specialization-help">{specializationHelp}</p>
                </div>
              )}
              <div className="form-group tariff-description-field">
                <label htmlFor="tariff-description">Description</label>
                <input id="tariff-description" value={form.description} required maxLength={300}
                  onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </div>
              <div className="form-group">
                <label htmlFor="tariff-price">Unit price</label>
                <input id="tariff-price" type="number" min="0.01" step="0.01" value={form.unitPrice} required
                  onChange={(event) => setForm({ ...form, unitPrice: event.target.value })} />
              </div>
              <div className="form-group">
                <label htmlFor="tariff-currency">Currency</label>
                <input id="tariff-currency" value={form.currency} minLength={3} maxLength={3} required
                  onChange={(event) => setForm({ ...form, currency: event.target.value })} />
              </div>
              <div className="form-group">
                <label htmlFor="tariff-effective">Effective from</label>
                <input id="tariff-effective" type="datetime-local" value={form.effectiveFrom} required
                  onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={closeForm} disabled={isSaving}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Saving…' : editing ? 'Schedule new price' : 'Save tariff'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card table-card">
        {isLoading ? (
          <div className="table-loading"><div className="spinner" /><p>Loading service tariffs…</p></div>
        ) : tariffs.length === 0 ? (
          <div className="table-empty"><p>No service tariffs found.</p></div>
        ) : (
          <div className="table-responsive">
            <table className="data-table tariff-table">
              <thead><tr><th>Service</th><th>Applies to</th><th>Price</th><th>Effective period</th><th>Status</th>{canManage && <th>Actions</th>}</tr></thead>
              <tbody>
                {tariffs.map((tariff) => {
                  const status = statusOf(tariff);
                  const isLatest = latestByCode.get(tariff.serviceCode)?.tariffId === tariff.tariffId;
                  return (
                    <tr key={tariff.tariffId}>
                      <td><strong>{tariff.serviceCode}</strong><span className="tariff-description">{tariff.description}</span></td>
                      <td>{appliesTo(tariff.serviceCode, specializationByCode, specializationsState)}</td>
                      <td className="tariff-price">{money(tariff.unitPrice, tariff.currency)}</td>
                      <td><span>{dateTimeLabel(tariff.effectiveFromUtc)}</span><span className="tariff-description">to {tariff.effectiveToUtc ? dateTimeLabel(tariff.effectiveToUtc) : 'open-ended'}</span></td>
                      <td><span className={`badge tariff-status tariff-status--${status.toLowerCase()}`}>{status}</span></td>
                      {canManage && (
                        <td>
                          {isLatest && tariff.isActive && (
                            <div className="action-buttons">
                              <button type="button" className="btn btn-sm btn-outline" onClick={() => startPriceChange(tariff)}>Update price</button>
                              <button type="button" className="btn btn-sm btn-danger-outline" onClick={() => void deactivate(tariff)}>Deactivate</button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceTariffsPage;
