import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VehicleCard } from '../src/components/vehicles/VehicleCard.js';
import type { Vehicle } from '../src/types/index.js';

const vehicle: Vehicle = {
  id: 'v1',
  make: 'Toyota',
  model: 'Corolla',
  category: 'SEDAN',
  year: 2023,
  price: 21500,
  quantity: 3,
  description: 'Reliable commuter',
  imageUrl: null,
  createdAt: '2026-01-01 10:00:00',
  updatedAt: '2026-01-01 10:00:00',
};

const noop = () => undefined;

describe('VehicleCard', () => {
  it('shows the vehicle details and a formatted price', () => {
    render(<VehicleCard vehicle={vehicle} isAdmin={false} onPurchase={noop} />);

    expect(screen.getByRole('heading', { name: 'Corolla' })).toBeInTheDocument();
    expect(screen.getByText(/2023/)).toBeInTheDocument();
    expect(screen.getByText('$21,500')).toBeInTheDocument();
    expect(screen.getByText('Reliable commuter')).toBeInTheDocument();
  });

  it('enables the purchase button while there is stock', () => {
    render(<VehicleCard vehicle={vehicle} isAdmin={false} onPurchase={noop} />);

    expect(screen.getByRole('button', { name: /purchase/i })).toBeEnabled();
  });

  it('disables the purchase button when the quantity is zero', () => {
    // This is the behaviour the brief calls out explicitly.
    render(<VehicleCard vehicle={{ ...vehicle, quantity: 0 }} isAdmin={false} onPurchase={noop} />);

    const button = screen.getByRole('button', { name: /out of stock/i });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Out of stock');
  });

  it('does not call onPurchase when a sold-out card is clicked', async () => {
    const onPurchase = vi.fn();
    render(
      <VehicleCard vehicle={{ ...vehicle, quantity: 0 }} isAdmin={false} onPurchase={onPurchase} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /out of stock/i }));

    expect(onPurchase).not.toHaveBeenCalled();
  });

  it('calls onPurchase with the vehicle when clicked', async () => {
    const onPurchase = vi.fn();
    render(<VehicleCard vehicle={vehicle} isAdmin={false} onPurchase={onPurchase} />);

    await userEvent.click(screen.getByRole('button', { name: /purchase/i }));

    expect(onPurchase).toHaveBeenCalledWith(vehicle);
  });

  it('labels the stock level, down to the last one', () => {
    const { rerender } = render(
      <VehicleCard vehicle={vehicle} isAdmin={false} onPurchase={noop} />,
    );
    expect(screen.getByText('3 in stock')).toBeInTheDocument();

    rerender(
      <VehicleCard vehicle={{ ...vehicle, quantity: 1 }} isAdmin={false} onPurchase={noop} />,
    );
    expect(screen.getByText('1 left')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /buy the last one/i })).toBeEnabled();

    rerender(
      <VehicleCard vehicle={{ ...vehicle, quantity: 0 }} isAdmin={false} onPurchase={noop} />,
    );
    expect(screen.getByText('Sold out')).toBeInTheDocument();
  });

  it('hides the admin controls from a customer', () => {
    render(<VehicleCard vehicle={vehicle} isAdmin={false} onPurchase={noop} />);

    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /restock/i })).not.toBeInTheDocument();
  });

  it('offers edit, restock and delete to an admin', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onRestock = vi.fn();

    render(
      <VehicleCard
        vehicle={vehicle}
        isAdmin
        onPurchase={noop}
        onEdit={onEdit}
        onDelete={onDelete}
        onRestock={onRestock}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    await userEvent.click(screen.getByRole('button', { name: /restock/i }));
    await userEvent.click(screen.getByRole('button', { name: /delete/i }));

    expect(onEdit).toHaveBeenCalledWith(vehicle);
    expect(onRestock).toHaveBeenCalledWith(vehicle);
    expect(onDelete).toHaveBeenCalledWith(vehicle);
  });

  it('keeps the admin controls available for a sold-out vehicle, so it can be restocked', () => {
    render(
      <VehicleCard
        vehicle={{ ...vehicle, quantity: 0 }}
        isAdmin
        onPurchase={noop}
        onRestock={noop}
      />,
    );

    expect(screen.getByRole('button', { name: /out of stock/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /restock/i })).toBeEnabled();
  });

  it('disables the purchase button while a purchase is in flight', () => {
    render(<VehicleCard vehicle={vehicle} isAdmin={false} busy onPurchase={noop} />);

    expect(screen.getByRole('button', { name: /purchase/i })).toBeDisabled();
  });
});
