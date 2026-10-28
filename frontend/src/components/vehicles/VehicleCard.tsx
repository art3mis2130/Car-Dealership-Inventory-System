import { useState } from 'react';
import { Button } from '../ui/Button.js';
import { formatCategory, formatPrice } from '../../lib/format.js';
import type { Vehicle } from '../../types/index.js';

interface VehicleCardProps {
  vehicle: Vehicle;
  isAdmin: boolean;
  busy?: boolean;
  onPurchase: (vehicle: Vehicle) => void;
  onEdit?: (vehicle: Vehicle) => void;
  onDelete?: (vehicle: Vehicle) => void;
  onRestock?: (vehicle: Vehicle) => void;
}

/** Category-tinted gradients, so the grid reads as a varied showroom. */
const CATEGORY_TINTS: Record<string, string> = {
  SEDAN: 'from-sky-500/25 to-blue-700/10',
  SUV: 'from-emerald-500/25 to-teal-700/10',
  HATCHBACK: 'from-violet-500/25 to-purple-700/10',
  TRUCK: 'from-orange-500/25 to-amber-700/10',
  COUPE: 'from-rose-500/25 to-red-700/10',
  CONVERTIBLE: 'from-pink-500/25 to-fuchsia-700/10',
  VAN: 'from-cyan-500/25 to-sky-700/10',
  ELECTRIC: 'from-lime-500/25 to-green-700/10',
};

export function VehicleCard({
  vehicle,
  isAdmin,
  busy = false,
  onPurchase,
  onEdit,
  onDelete,
  onRestock,
}: VehicleCardProps) {
  // A dead photo URL must degrade to the generated artwork rather than
  // leaving a broken-image icon sitting in the grid.
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = Boolean(vehicle.imageUrl) && !photoFailed;

  const soldOut = vehicle.quantity === 0;
  const lastOne = vehicle.quantity === 1;
  const tint = CATEGORY_TINTS[vehicle.category] ?? 'from-ink-600/30 to-ink-800/10';

  return (
    <article
      className="surface group flex flex-col overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:border-brand-400/40 hover:shadow-lift"
      aria-label={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
    >
      {/* A photo when the listing has one, generated artwork when it does not. */}
      <div className={`relative h-36 overflow-hidden bg-gradient-to-br ${tint}`}>
        {showPhoto ? (
          <img
            src={vehicle.imageUrl ?? ''}
            alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
            loading="lazy"
            decoding="async"
            onError={() => setPhotoFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <svg
            className="absolute inset-0 m-auto h-20 w-20 text-ink-100/25 transition-transform duration-300 group-hover:scale-105"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
          </svg>
        )}

        <span className="absolute left-3 top-3 rounded-full border border-ink-100/15 bg-ink-950/70 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-ink-200 backdrop-blur-sm">
          {formatCategory(vehicle.category)}
        </span>

        <StockBadge quantity={vehicle.quantity} />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-brand-400">
            {vehicle.year} &middot; {vehicle.make}
          </p>
          <h3 className="mt-0.5 text-lg font-semibold leading-tight text-ink-100">
            {vehicle.model}
          </h3>
        </div>

        {vehicle.description ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-ink-400">{vehicle.description}</p>
        ) : null}

        <p className="mt-auto text-2xl font-bold tracking-tight text-ink-100">
          {formatPrice(vehicle.price)}
        </p>

        <div className="flex flex-col gap-2">
          <Button
            onClick={() => onPurchase(vehicle)}
            disabled={soldOut}
            loading={busy}
            fullWidth
            /*
             * The brief calls for the purchase button to be disabled at zero
             * stock. `disabled` does the real work; the title explains why,
             * so the state is not conveyed by colour alone.
             */
            title={soldOut ? 'Out of stock' : `Buy this ${vehicle.make} ${vehicle.model}`}
            icon={
              !busy ? (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              ) : undefined
            }
          >
            {soldOut ? 'Out of stock' : lastOne ? 'Buy the last one' : 'Purchase'}
          </Button>

          {isAdmin ? (
            <div className="flex gap-2 border-t border-ink-700/60 pt-2">
              <Button variant="ghost" size="sm" onClick={() => onEdit?.(vehicle)} fullWidth>
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onRestock?.(vehicle)} fullWidth>
                Restock
              </Button>
              <Button variant="danger" size="sm" onClick={() => onDelete?.(vehicle)} fullWidth>
                Delete
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** Stock level as a colour-coded chip: sold out, last one, or a count. */
function StockBadge({ quantity }: { quantity: number }) {
  const tone =
    quantity === 0
      ? 'border-danger-500/40 bg-danger-500/15 text-danger-300'
      : quantity <= 2
        ? 'border-brand-400/40 bg-brand-400/15 text-brand-300'
        : 'border-success-500/40 bg-success-500/15 text-success-300';

  const label = quantity === 0 ? 'Sold out' : quantity === 1 ? '1 left' : `${quantity} in stock`;

  return (
    <span
      className={`absolute right-3 top-3 rounded-full border px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm ${tone}`}
    >
      {label}
    </span>
  );
}
