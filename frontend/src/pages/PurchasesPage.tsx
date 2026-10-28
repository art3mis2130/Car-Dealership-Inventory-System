import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { ApiError } from '../lib/api.js';
import { formatCategory, formatDate, formatPrice } from '../lib/format.js';
import { Button } from '../components/ui/Button.js';
import { EmptyState } from '../components/vehicles/VehicleGrid.js';
import type { Purchase } from '../types/index.js';

/** The signed-in user's own purchase history, newest first. */
export function PurchasesPage() {
  const { api } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    api
      .myPurchases()
      .then(({ purchases: mine }) => {
        if (!cancelled) setPurchases(mine);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof ApiError ? cause.message : 'Could not load your purchases');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [api]);

  const total = purchases.reduce((sum, purchase) => sum + purchase.totalPrice, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">My purchases</h1>
        <p className="mt-1.5 text-sm text-ink-400">
          {loading
            ? 'Loading your history...'
            : purchases.length === 0
              ? 'Nothing here yet.'
              : `${purchases.length} purchase${purchases.length === 1 ? '' : 's'}, ${formatPrice(total)} in total.`}
        </p>
      </header>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="surface h-24 p-5" aria-hidden="true">
              <div className="skeleton h-4 w-40" />
              <div className="skeleton mt-3 h-3 w-24" />
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState title="Could not load your purchases" message={error} />
      ) : purchases.length === 0 ? (
        <EmptyState
          title="No purchases yet"
          message="When you buy a vehicle from the showroom it will appear here with the price you paid."
          action={
            <Link to="/">
              <Button variant="secondary">Browse the showroom</Button>
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {purchases.map((purchase) => (
            <li
              key={purchase.id}
              className="surface flex flex-wrap items-center justify-between gap-4 p-5 animate-fade-up"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-brand-400">
                  {purchase.vehicle
                    ? `${purchase.vehicle.year} ${purchase.vehicle.make}`
                    : 'Vehicle no longer listed'}
                </p>
                <h2 className="mt-0.5 truncate text-lg font-semibold">
                  {purchase.vehicle?.model ?? 'Removed listing'}
                </h2>
                <p className="mt-1 text-sm text-ink-400">
                  {purchase.vehicle ? `${formatCategory(purchase.vehicle.category)} - ` : ''}
                  bought {formatDate(purchase.purchasedAt)}
                </p>
              </div>

              <div className="text-right">
                <p className="text-xl font-bold">{formatPrice(purchase.totalPrice)}</p>
                <p className="text-xs text-ink-400">
                  {purchase.quantity} x {formatPrice(purchase.unitPrice)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
