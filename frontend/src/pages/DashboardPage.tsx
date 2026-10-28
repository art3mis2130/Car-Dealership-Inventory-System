import { useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { useToast } from '../hooks/useToast.js';
import { useVehicles } from '../hooks/useVehicles.js';
import { ApiError } from '../lib/api.js';
import { formatPrice } from '../lib/format.js';
import { Button } from '../components/ui/Button.js';
import { Modal } from '../components/ui/Modal.js';
import { TextField } from '../components/ui/Field.js';
import { VehicleCard } from '../components/vehicles/VehicleCard.js';
import { VehicleFilters } from '../components/vehicles/VehicleFilters.js';
import { VehicleFormModal } from '../components/vehicles/VehicleFormModal.js';
import {
  EmptyState,
  Pagination,
  VehicleGrid,
  VehicleGridSkeleton,
} from '../components/vehicles/VehicleGrid.js';
import type { Vehicle, VehicleFilters as Filters, VehicleInput } from '../types/index.js';

/** Which dialog, if any, is open. One state field keeps them mutually exclusive. */
type Dialog =
  | { kind: 'none' }
  | { kind: 'form'; vehicle: Vehicle | null }
  | { kind: 'delete'; vehicle: Vehicle }
  | { kind: 'restock'; vehicle: Vehicle };

/** The showroom: search, browse, buy, and (for admins) manage the inventory. */
export function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const { api } = useAuth();
  const { notify } = useToast();

  const [filters, setFilters] = useState<Filters>({ sort: 'newest', page: 1, limit: 12 });
  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [restockQuantity, setRestockQuantity] = useState('1');

  const {
    vehicles,
    meta,
    makes,
    categories,
    loading,
    error,
    refresh,
    replaceVehicle,
    removeVehicle,
  } = useVehicles(filters);

  const stats = useMemo(
    () => ({
      listings: meta.total,
      inStock: vehicles.reduce((sum, vehicle) => sum + vehicle.quantity, 0),
      cheapest: vehicles.length ? Math.min(...vehicles.map((vehicle) => vehicle.price)) : null,
    }),
    [vehicles, meta.total],
  );

  const closeDialog = () => {
    setDialog({ kind: 'none' });
    setFieldErrors({});
  };

  /** Maps a 422 response back onto the form fields that caused it. */
  const applyApiError = (cause: unknown, fallback: string): void => {
    if (cause instanceof ApiError && cause.details?.length) {
      setFieldErrors(Object.fromEntries(cause.details.map((d) => [d.field, d.message])));
      return;
    }

    notify(cause instanceof ApiError ? cause.message : fallback, 'error');
  };

  const purchase = async (vehicle: Vehicle) => {
    setBusyId(vehicle.id);

    try {
      const result = await api.purchaseVehicle(vehicle.id, 1);
      replaceVehicle(result.vehicle);
      notify(
        `Bought the ${result.vehicle.year} ${result.vehicle.make} ${result.vehicle.model} for ${formatPrice(result.purchase.totalPrice)}.`,
        'success',
      );
    } catch (cause: unknown) {
      // A 409 means someone else got there first, so resync the list.
      if (cause instanceof ApiError && cause.status === 409) refresh();
      notify(cause instanceof ApiError ? cause.message : 'The purchase failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const saveVehicle = async (input: VehicleInput) => {
    if (dialog.kind !== 'form') return;

    setSaving(true);
    setFieldErrors({});

    try {
      if (dialog.vehicle) {
        const { vehicle } = await api.updateVehicle(dialog.vehicle.id, input);
        replaceVehicle(vehicle);
        notify(`Updated the ${vehicle.make} ${vehicle.model}.`, 'success');
      } else {
        const { vehicle } = await api.createVehicle(input);
        notify(`Listed the ${vehicle.year} ${vehicle.make} ${vehicle.model}.`, 'success');
        refresh();
      }

      closeDialog();
    } catch (cause: unknown) {
      applyApiError(cause, 'Could not save the vehicle');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (dialog.kind !== 'delete') return;

    setSaving(true);

    try {
      await api.deleteVehicle(dialog.vehicle.id);
      removeVehicle(dialog.vehicle.id);
      notify(`Removed the ${dialog.vehicle.make} ${dialog.vehicle.model} from the lot.`, 'success');
      closeDialog();
    } catch (cause: unknown) {
      applyApiError(cause, 'Could not delete the vehicle');
    } finally {
      setSaving(false);
    }
  };

  const confirmRestock = async () => {
    if (dialog.kind !== 'restock') return;

    setSaving(true);
    setFieldErrors({});

    try {
      const { vehicle } = await api.restockVehicle(dialog.vehicle.id, Number(restockQuantity));
      replaceVehicle(vehicle);
      notify(`${vehicle.make} ${vehicle.model} restocked to ${vehicle.quantity}.`, 'success');
      closeDialog();
    } catch (cause: unknown) {
      applyApiError(cause, 'Could not restock the vehicle');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero ----------------------------------------------------------- */}
      <section className="surface relative overflow-hidden p-6 sm:p-8">
        <div
          className="absolute inset-0 bg-gradient-to-r from-brand-500/10 via-transparent to-info-400/10"
          aria-hidden="true"
        />

        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-400">
              {isAdmin ? 'Inventory management' : 'Showroom'}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              {greeting()}, {user?.name.split(' ')[0]}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-ink-300">
              {isAdmin
                ? 'Add, price and restock the lot. Everything you change is live immediately.'
                : 'Every car on the lot, with live stock levels. Find one you like and drive it away.'}
            </p>
          </div>

          <dl className="flex flex-wrap gap-3">
            <Stat label="Listings" value={String(stats.listings)} />
            <Stat label="Cars on this page" value={String(stats.inStock)} />
            <Stat
              label="From"
              value={stats.cheapest !== null ? formatPrice(stats.cheapest) : '-'}
            />
          </dl>
        </div>

        {isAdmin ? (
          <div className="relative mt-6 flex flex-wrap gap-3">
            <Button onClick={() => setDialog({ kind: 'form', vehicle: null })}>
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add a vehicle
            </Button>
            <Button variant="secondary" onClick={refresh}>
              Refresh inventory
            </Button>
          </div>
        ) : null}
      </section>

      {/* Filters -------------------------------------------------------- */}
      <VehicleFilters
        value={filters}
        makes={makes}
        categories={categories}
        resultCount={meta.total}
        onChange={setFilters}
      />

      {/* Results -------------------------------------------------------- */}
      {loading ? (
        <VehicleGridSkeleton />
      ) : error ? (
        <EmptyState
          title="Could not load the inventory"
          message={error}
          action={
            <Button variant="secondary" onClick={refresh}>
              Try again
            </Button>
          }
        />
      ) : vehicles.length === 0 ? (
        <EmptyState
          title="No vehicles match those filters"
          message="Try widening the price range, or clear the filters to see the whole lot."
          action={
            <Button
              variant="secondary"
              onClick={() => setFilters({ sort: 'newest', page: 1, limit: 12 })}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <VehicleGrid>
            {vehicles.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                isAdmin={isAdmin}
                busy={busyId === vehicle.id}
                onPurchase={(vehicle) => void purchase(vehicle)}
                onEdit={(target) => setDialog({ kind: 'form', vehicle: target })}
                onDelete={(target) => setDialog({ kind: 'delete', vehicle: target })}
                onRestock={(target) => {
                  setRestockQuantity('1');
                  setDialog({ kind: 'restock', vehicle: target });
                }}
              />
            ))}
          </VehicleGrid>

          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            onChange={(page) => setFilters((current) => ({ ...current, page }))}
          />
        </>
      )}

      {/* Dialogs -------------------------------------------------------- */}
      <VehicleFormModal
        open={dialog.kind === 'form'}
        vehicle={dialog.kind === 'form' ? dialog.vehicle : null}
        saving={saving}
        fieldErrors={fieldErrors}
        onClose={closeDialog}
        onSubmit={(input) => void saveVehicle(input)}
      />

      <Modal
        open={dialog.kind === 'delete'}
        title="Delete this listing?"
        description={
          dialog.kind === 'delete'
            ? `${dialog.vehicle.year} ${dialog.vehicle.make} ${dialog.vehicle.model} will be removed from the lot. Past purchases keep their records.`
            : undefined
        }
        onClose={closeDialog}
        footer={
          <>
            <Button variant="secondary" onClick={closeDialog} disabled={saving}>
              Keep it
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()} loading={saving}>
              Delete listing
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-300">This cannot be undone.</p>
      </Modal>

      <Modal
        open={dialog.kind === 'restock'}
        title="Restock"
        description={
          dialog.kind === 'restock'
            ? `Currently ${dialog.vehicle.quantity} in stock. How many are arriving?`
            : undefined
        }
        onClose={closeDialog}
        footer={
          <>
            <Button variant="secondary" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void confirmRestock()} loading={saving}>
              Add to stock
            </Button>
          </>
        }
      >
        <TextField
          label="Quantity arriving"
          type="number"
          min={1}
          value={restockQuantity}
          onChange={(event) => setRestockQuantity(event.target.value)}
          error={fieldErrors.quantity}
        />
      </Modal>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-700/70 bg-ink-850/60 px-4 py-3">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-ink-400">{label}</dt>
      <dd className="mt-0.5 text-xl font-bold text-ink-100">{value}</dd>
    </div>
  );
}

function greeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';

  return 'Good evening';
}
