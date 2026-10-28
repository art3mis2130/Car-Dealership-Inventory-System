import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { createTestDatabase } from '../helpers/testDb.js';
import { VehicleRepository } from '../../src/repositories/vehicleRepository.js';
import { VehicleService } from '../../src/services/vehicleService.js';
import { createVehicleSchema } from '../../src/validation/vehicleSchemas.js';
import type { CreateVehicleInput } from '../../src/validation/vehicleSchemas.js';

const base: CreateVehicleInput = {
  make: 'Toyota',
  model: 'Corolla',
  category: 'SEDAN',
  year: 2022,
  price: 21_500,
  quantity: 4,
  description: null,
  imageUrl: null,
};

describe('vehicle photos', () => {
  let db: Database;
  let cleanup: () => void;
  let service: VehicleService;

  beforeEach(() => {
    ({ db, cleanup } = createTestDatabase());
    service = new VehicleService(new VehicleRepository(db));
  });

  afterEach(() => cleanup());

  it('stores and returns an image URL', () => {
    const vehicle = service.create({
      ...base,
      imageUrl: 'https://cdn.example.com/corolla.jpg',
    });

    expect(vehicle.imageUrl).toBe('https://cdn.example.com/corolla.jpg');
    expect(service.findById(vehicle.id).imageUrl).toBe('https://cdn.example.com/corolla.jpg');
  });

  it('defaults to no image, so a listing without a photo is still valid', () => {
    expect(service.create(base).imageUrl).toBeNull();
  });

  it('can add a photo to an existing listing', () => {
    const vehicle = service.create(base);

    const updated = service.update(vehicle.id, { imageUrl: 'https://cdn.example.com/a.png' });

    expect(updated.imageUrl).toBe('https://cdn.example.com/a.png');
  });

  it('can clear a photo again', () => {
    const vehicle = service.create({ ...base, imageUrl: 'https://cdn.example.com/a.png' });

    expect(service.update(vehicle.id, { imageUrl: null }).imageUrl).toBeNull();
  });

  describe('validation', () => {
    it('accepts an https URL', () => {
      const parsed = createVehicleSchema.safeParse({
        ...base,
        imageUrl: 'https://cdn.example.com/a.jpg',
      });

      expect(parsed.success).toBe(true);
    });

    it('rejects a string that is not a URL', () => {
      expect(createVehicleSchema.safeParse({ ...base, imageUrl: 'not a url' }).success).toBe(false);
    });

    it.each(['javascript:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', 'file:///etc/passwd'])(
      'rejects the %s scheme',
      (imageUrl) => {
        // An image URL ends up in a src attribute, so only http(s) is allowed
        // rather than trusting whatever scheme an admin pastes in.
        expect(createVehicleSchema.safeParse({ ...base, imageUrl }).success).toBe(false);
      },
    );
  });
});
