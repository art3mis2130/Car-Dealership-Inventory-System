import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VehicleFilters } from '../src/components/vehicles/VehicleFilters.js';
import { formatCategory, formatDate, formatPrice, initials } from '../src/lib/format.js';

const baseProps = {
  value: { sort: 'newest' as const, page: 1 },
  makes: ['Ford', 'Toyota'],
  categories: ['SEDAN', 'SUV'],
  resultCount: 2,
};

describe('VehicleFilters', () => {
  it('reports how many vehicles matched', () => {
    render(<VehicleFilters {...baseProps} onChange={() => undefined} />);

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/vehicles found/i)).toBeInTheDocument();
  });

  it('uses the singular for a single result', () => {
    render(<VehicleFilters {...baseProps} resultCount={1} onChange={() => undefined} />);

    expect(screen.getByText(/vehicle found/i)).toBeInTheDocument();
  });

  it('offers every make and category it was given', () => {
    render(<VehicleFilters {...baseProps} onChange={() => undefined} />);

    expect(screen.getByRole('option', { name: 'Toyota' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Suv' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'All makes' })).toBeInTheDocument();
  });

  it('applies a make selection immediately and resets to page 1', async () => {
    const onChange = vi.fn();
    render(
      <VehicleFilters {...baseProps} value={{ sort: 'newest', page: 4 }} onChange={onChange} />,
    );

    await userEvent.selectOptions(screen.getByLabelText('Make'), 'Toyota');

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ make: 'Toyota', page: 1 }));
  });

  it('debounces the free-text search instead of firing per keystroke', async () => {
    const onChange = vi.fn();
    render(<VehicleFilters {...baseProps} onChange={onChange} />);

    await userEvent.type(screen.getByLabelText('Search'), 'corolla');

    // Nothing yet: the debounce has not elapsed.
    expect(onChange).not.toHaveBeenCalled();

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1), { timeout: 1500 });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ q: 'corolla', page: 1 }));
  });

  it('toggles the in-stock-only filter', async () => {
    const onChange = vi.fn();
    render(<VehicleFilters {...baseProps} onChange={onChange} />);

    await userEvent.click(screen.getByLabelText(/in stock only/i));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ availableOnly: true }));
  });

  it('only offers "Clear filters" once a filter is active', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<VehicleFilters {...baseProps} onChange={onChange} />);

    expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();

    rerender(
      <VehicleFilters
        {...baseProps}
        value={{ sort: 'newest', make: 'Ford' }}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /clear filters/i }));

    expect(onChange).toHaveBeenCalledWith({ sort: 'newest', page: 1 });
  });
});

describe('formatting helpers', () => {
  it('formats whole prices without cents', () => {
    expect(formatPrice(21500)).toBe('$21,500');
  });

  it('keeps cents when a price has them', () => {
    expect(formatPrice(21500.5)).toBe('$21,500.50');
  });

  it('formats a SQLite timestamp', () => {
    expect(formatDate('2026-03-14 09:30:00')).toMatch(/2026/);
  });

  it('returns the original string for an unparseable date', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('title-cases a category for display', () => {
    expect(formatCategory('CONVERTIBLE')).toBe('Convertible');
  });

  it('takes at most two initials', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('Avery Admin Jones')).toBe('AA');
    expect(initials('Cher')).toBe('C');
  });
});
