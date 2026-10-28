import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal.js';
import { Button } from '../ui/Button.js';
import { SelectField, TextAreaField, TextField } from '../ui/Field.js';
import { formatCategory } from '../../lib/format.js';
import { VEHICLE_CATEGORIES, type Vehicle, type VehicleInput } from '../../types/index.js';

interface VehicleFormModalProps {
  open: boolean;
  /** Present when editing, absent when adding. */
  vehicle?: Vehicle | null;
  saving: boolean;
  fieldErrors: Record<string, string>;
  onClose: () => void;
  onSubmit: (input: VehicleInput) => void;
}

type FormState = {
  make: string;
  model: string;
  category: string;
  year: string;
  price: string;
  quantity: string;
  description: string;
  imageUrl: string;
};

const EMPTY_FORM: FormState = {
  make: '',
  model: '',
  category: 'SEDAN',
  year: String(new Date().getFullYear()),
  price: '',
  quantity: '1',
  description: '',
  imageUrl: '',
};

/**
 * Reads a numeric field, treating blank as *missing* rather than as zero.
 *
 * `Number('')` is 0, so without this an empty Price field quietly lists a car
 * for nothing instead of failing validation. Sending undefined lets the
 * server's own "Price is required" rule fire and come back attached to the
 * field. A deliberate 0 still comes through as 0, because zero stock is a
 * legitimate listing.
 */
function toNumber(value: string): number | undefined {
  const trimmed = value.trim();

  if (trimmed === '') return undefined;

  const parsed = Number(trimmed);

  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * One form for both adding and editing, since the fields are identical and
 * two near-duplicate forms would drift apart. Server-side validation errors
 * are shown against the field they belong to.
 */
export function VehicleFormModal({
  open,
  vehicle,
  saving,
  fieldErrors,
  onClose,
  onSubmit,
}: VehicleFormModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Reload the form whenever the dialog opens for a different vehicle.
  useEffect(() => {
    if (!open) return;

    setForm(
      vehicle
        ? {
            make: vehicle.make,
            model: vehicle.model,
            category: vehicle.category,
            year: String(vehicle.year),
            price: String(vehicle.price),
            quantity: String(vehicle.quantity),
            description: vehicle.description ?? '',
            imageUrl: vehicle.imageUrl ?? '',
          }
        : EMPTY_FORM,
    );
  }, [open, vehicle]);

  const set = <K extends keyof FormState>(key: K, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    onSubmit({
      make: form.make.trim(),
      model: form.model.trim(),
      category: form.category,
      year: toNumber(form.year),
      price: toNumber(form.price),
      quantity: toNumber(form.quantity),
      description: form.description.trim() || null,
      // An empty field clears the photo rather than sending "".
      imageUrl: form.imageUrl.trim() || null,
    });
  };

  return (
    <Modal
      open={open}
      title={vehicle ? `Edit ${vehicle.make} ${vehicle.model}` : 'Add a vehicle'}
      description={
        vehicle
          ? 'Update the listing. Only the fields you change are sent.'
          : 'List a new vehicle on the lot.'
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Make"
            value={form.make}
            onChange={(event) => set('make', event.target.value)}
            error={fieldErrors.make}
            placeholder="Toyota"
            required
          />
          <TextField
            label="Model"
            value={form.model}
            onChange={(event) => set('model', event.target.value)}
            error={fieldErrors.model}
            placeholder="Corolla"
            required
          />
          <SelectField
            label="Category"
            value={form.category}
            onChange={(event) => set('category', event.target.value)}
            error={fieldErrors.category}
          >
            {VEHICLE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {formatCategory(category)}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Model year"
            type="number"
            min={1900}
            value={form.year}
            onChange={(event) => set('year', event.target.value)}
            error={fieldErrors.year}
            required
          />
          <TextField
            label="Price (USD)"
            type="number"
            min={0}
            step={100}
            value={form.price}
            onChange={(event) => set('price', event.target.value)}
            error={fieldErrors.price}
            placeholder="21500"
            required
          />
          <TextField
            label="Quantity in stock"
            type="number"
            min={0}
            value={form.quantity}
            onChange={(event) => set('quantity', event.target.value)}
            error={fieldErrors.quantity}
            hint="Zero is allowed - the listing shows as sold out."
            required
          />
        </div>

        <TextField
          label="Photo URL"
          type="url"
          inputMode="url"
          value={form.imageUrl}
          onChange={(event) => set('imageUrl', event.target.value)}
          error={fieldErrors.imageUrl}
          placeholder="https://..."
          hint="Optional. Leave empty to use the generated artwork."
        />

        <TextAreaField
          label="Description"
          rows={3}
          value={form.description}
          onChange={(event) => set('description', event.target.value)}
          error={fieldErrors.description}
          placeholder="What makes this one worth a look?"
        />

        {fieldErrors['(root)'] ? (
          <p className="text-sm text-danger-300">{fieldErrors['(root)']}</p>
        ) : null}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {vehicle ? 'Save changes' : 'Add vehicle'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
