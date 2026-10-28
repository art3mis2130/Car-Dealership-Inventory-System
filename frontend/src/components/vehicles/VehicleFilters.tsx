import { useEffect, useState } from 'react';
import { SelectField, TextField } from '../ui/Field.js';
import { Button } from '../ui/Button.js';
import { formatCategory } from '../../lib/format.js';
import type { VehicleFilters as Filters } from '../../types/index.js';

interface VehicleFiltersProps {
  value: Filters;
  makes: string[];
  categories: string[];
  resultCount: number;
  onChange: (filters: Filters) => void;
}

/**
 * The search and filter bar.
 *
 * The free-text box is debounced so typing does not fire a request per
 * keystroke; the selects apply immediately, because a dropdown choice is a
 * deliberate single action.
 */
export function VehicleFilters({
  value,
  makes,
  categories,
  resultCount,
  onChange,
}: VehicleFiltersProps) {
  const [query, setQuery] = useState(value.q ?? '');

  // Keep the input in step when filters are cleared from outside.
  useEffect(() => {
    setQuery(value.q ?? '');
  }, [value.q]);

  useEffect(() => {
    if (query === (value.q ?? '')) return;

    const timer = window.setTimeout(() => onChange({ ...value, q: query, page: 1 }), 300);
    return () => window.clearTimeout(timer);
  }, [query, value, onChange]);

  const update = (patch: Filters) => onChange({ ...value, ...patch, page: 1 });

  const activeCount = [
    value.make,
    value.category,
    value.minPrice,
    value.maxPrice,
    value.availableOnly ? 'yes' : undefined,
    value.q,
  ].filter(Boolean).length;

  return (
    <section className="surface p-5" aria-label="Search and filter vehicles">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <TextField
            label="Search"
            type="search"
            placeholder="Make, model, keyword..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <SelectField
          label="Make"
          value={value.make ?? ''}
          onChange={(event) => update({ make: event.target.value || undefined })}
        >
          <option value="">All makes</option>
          {makes.map((make) => (
            <option key={make} value={make}>
              {make}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Category"
          value={value.category ?? ''}
          onChange={(event) => update({ category: event.target.value || undefined })}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {formatCategory(category)}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Sort by"
          value={value.sort ?? 'newest'}
          onChange={(event) => update({ sort: event.target.value as Filters['sort'] })}
        >
          <option value="newest">Newest listings</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="year_desc">Model year: newest</option>
        </SelectField>

        <TextField
          label="Min price"
          type="number"
          min={0}
          step={500}
          placeholder="0"
          value={value.minPrice ?? ''}
          onChange={(event) =>
            update({ minPrice: event.target.value ? Number(event.target.value) : undefined })
          }
        />

        <TextField
          label="Max price"
          type="number"
          min={0}
          step={500}
          placeholder="Any"
          value={value.maxPrice ?? ''}
          onChange={(event) =>
            update({ maxPrice: event.target.value ? Number(event.target.value) : undefined })
          }
        />

        <label className="flex cursor-pointer select-none items-end gap-2.5 pb-2.5 text-sm text-ink-200">
          <input
            type="checkbox"
            checked={value.availableOnly ?? false}
            onChange={(event) => update({ availableOnly: event.target.checked || undefined })}
            className="h-4 w-4 rounded border-ink-500 bg-ink-850 text-brand-500 focus:ring-brand-400/40"
          />
          In stock only
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink-700/60 pt-4">
        {/* Announced to screen readers when filtering changes the count,
            which is otherwise a silent, purely visual update. */}
        <p className="text-sm text-ink-400" role="status" aria-live="polite">
          <span className="font-semibold text-ink-100">{resultCount}</span>{' '}
          {resultCount === 1 ? 'vehicle' : 'vehicles'} found
          {activeCount > 0
            ? ` with ${activeCount} filter${activeCount === 1 ? '' : 's'} applied`
            : ''}
        </p>

        {activeCount > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => onChange({ sort: 'newest', page: 1 })}>
            Clear filters
          </Button>
        ) : null}
      </div>
    </section>
  );
}
