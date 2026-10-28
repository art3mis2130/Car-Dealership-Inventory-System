import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VehicleFormModal } from '../src/components/vehicles/VehicleFormModal.js';
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
  imageUrl: 'https://cdn.example.com/corolla.jpg',
  createdAt: '2026-01-01 10:00:00',
  updatedAt: '2026-01-01 10:00:00',
};

function renderForm(overrides: Partial<Parameters<typeof VehicleFormModal>[0]> = {}) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();

  render(
    <VehicleFormModal
      open
      saving={false}
      fieldErrors={{}}
      onClose={onClose}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );

  return { onSubmit, onClose };
}

describe('VehicleFormModal', () => {
  it('loads an existing vehicle into the fields when editing', () => {
    renderForm({ vehicle });

    expect(screen.getByLabelText('Make')).toHaveValue('Toyota');
    expect(screen.getByLabelText('Model')).toHaveValue('Corolla');
    expect(screen.getByLabelText('Price (USD)')).toHaveValue(21500);
    expect(screen.getByLabelText('Photo URL')).toHaveValue('https://cdn.example.com/corolla.jpg');
  });

  it('starts empty when adding', () => {
    renderForm({ vehicle: null });

    expect(screen.getByLabelText('Make')).toHaveValue('');
    expect(screen.getByLabelText('Photo URL')).toHaveValue('');
  });

  it('sends a blank price as missing rather than as zero', async () => {
    // Number('') is 0, so a blank field would otherwise list a car for $0
    // instead of failing validation. Found by leaving the field empty in the
    // running app and getting a free Audi.
    const { onSubmit } = renderForm({ vehicle: null });

    await userEvent.type(screen.getByLabelText('Make'), 'Audi');
    await userEvent.type(screen.getByLabelText('Model'), 'e-tron GT');
    await userEvent.clear(screen.getByLabelText('Price (USD)'));
    await userEvent.click(screen.getByRole('button', { name: /add vehicle/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ make: 'Audi', model: 'e-tron GT' });
    expect(onSubmit.mock.calls[0]?.[0].price).toBeUndefined();
  });

  it('sends a blank quantity as missing rather than as zero', async () => {
    const { onSubmit } = renderForm({ vehicle: null });

    await userEvent.clear(screen.getByLabelText('Quantity in stock'));
    await userEvent.click(screen.getByRole('button', { name: /add vehicle/i }));

    expect(onSubmit.mock.calls[0]?.[0].quantity).toBeUndefined();
  });

  it('still sends a deliberate zero quantity', async () => {
    // Zero stock is a legitimate listing - it shows as sold out - so it must
    // survive the "blank means missing" rule.
    const { onSubmit } = renderForm({ vehicle: null });

    const quantity = screen.getByLabelText('Quantity in stock');
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '0');
    await userEvent.click(screen.getByRole('button', { name: /add vehicle/i }));

    expect(onSubmit.mock.calls[0]?.[0].quantity).toBe(0);
  });

  it('sends an empty photo URL as null, so it clears the photo', async () => {
    const { onSubmit } = renderForm({ vehicle });

    await userEvent.clear(screen.getByLabelText('Photo URL'));
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(onSubmit.mock.calls[0]?.[0].imageUrl).toBeNull();
  });

  it('trims whitespace from text fields', async () => {
    const { onSubmit } = renderForm({ vehicle: null });

    await userEvent.type(screen.getByLabelText('Make'), '  Audi  ');
    await userEvent.click(screen.getByRole('button', { name: /add vehicle/i }));

    expect(onSubmit.mock.calls[0]?.[0].make).toBe('Audi');
  });

  it('shows server-side validation errors against the right field', () => {
    renderForm({ vehicle: null, fieldErrors: { price: 'Price cannot be negative' } });

    expect(screen.getByText('Price cannot be negative')).toBeInTheDocument();
    expect(screen.getByLabelText('Price (USD)')).toHaveAttribute('aria-invalid', 'true');
  });

  it('disables the controls while saving', () => {
    renderForm({ vehicle: null, saving: true });

    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });
});
