import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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

describe('VehicleCard photography', () => {
  it('shows generated artwork when a listing has no photo', () => {
    render(<VehicleCard vehicle={vehicle} isAdmin={false} onPurchase={noop} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows the photo when a listing has one', () => {
    render(
      <VehicleCard
        vehicle={{ ...vehicle, imageUrl: 'https://cdn.example.com/corolla.jpg' }}
        isAdmin={false}
        onPurchase={noop}
      />,
    );

    const image = screen.getByRole('img');

    expect(image).toHaveAttribute('src', 'https://cdn.example.com/corolla.jpg');
    expect(image).toHaveAccessibleName('2023 Toyota Corolla');
  });

  it('loads photos lazily, so a long grid does not fetch everything at once', () => {
    render(
      <VehicleCard
        vehicle={{ ...vehicle, imageUrl: 'https://cdn.example.com/corolla.jpg' }}
        isAdmin={false}
        onPurchase={noop}
      />,
    );

    expect(screen.getByRole('img')).toHaveAttribute('loading', 'lazy');
  });

  it('falls back to the artwork if the photo fails to load', () => {
    // A dead image URL must not leave a broken-image icon in the grid.
    render(
      <VehicleCard
        vehicle={{ ...vehicle, imageUrl: 'https://cdn.example.com/gone.jpg' }}
        isAdmin={false}
        onPurchase={noop}
      />,
    );

    fireEvent.error(screen.getByRole('img'));

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Corolla' })).toBeInTheDocument();
  });
});
