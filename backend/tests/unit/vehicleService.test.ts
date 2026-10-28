import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { createTestDatabase } from '../helpers/testDb.js';
import { VehicleRepository } from '../../src/repositories/vehicleRepository.js';
import { VehicleService } from '../../src/services/vehicleService.js';
import { ConflictError, NotFoundError } from '../../src/utils/errors.js';
import type { CreateVehicleInput } from '../../src/validation/vehicleSchemas.js';

const corolla: CreateVehicleInput = {
  make: 'Toyota',
  model: 'Corolla',
  category: 'SEDAN',
  year: 2022,
  price: 21_500,
  quantity: 4,
  description: 'Reliable commuter',
};

describe('VehicleService', () => {
  let db: Database;
  let cleanup: () => void;
  let service: VehicleService;

  beforeEach(() => {
    ({ db, cleanup } = createTestDatabase());
    service = new VehicleService(new VehicleRepository(db));
  });

  afterEach(() => cleanup());

  describe('create', () => {
    it('assigns a unique id and returns the stored vehicle', () => {
      const first = service.create(corolla);
      const second = service.create({ ...corolla, model: 'Camry' });

      expect(first.id).toBeTypeOf('string');
      expect(first.id).not.toBe(second.id);
      expect(first).toMatchObject({
        make: 'Toyota',
        model: 'Corolla',
        category: 'SEDAN',
        year: 2022,
        price: 21_500,
        quantity: 4,
      });
      expect(first.createdAt).toBeTypeOf('string');
    });

    it('trims whitespace from free-text fields', () => {
      const vehicle = service.create({ ...corolla, make: '  Toyota  ', model: ' Corolla ' });

      expect(vehicle.make).toBe('Toyota');
      expect(vehicle.model).toBe('Corolla');
    });

    it('rejects a duplicate make/model/year combination', () => {
      service.create(corolla);

      // The dealership tracks stock per model-year, so the same car twice is a
      // restock, not a second listing.
      expect(() => service.create({ ...corolla, quantity: 2 })).toThrow(ConflictError);
    });
  });

  describe('findById', () => {
    it('returns the vehicle', () => {
      const created = service.create(corolla);
      expect(service.findById(created.id).id).toBe(created.id);
    });

    it('throws NotFoundError for an unknown id', () => {
      expect(() => service.findById('does-not-exist')).toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    it('applies a partial patch and leaves other fields alone', () => {
      const created = service.create(corolla);

      const updated = service.update(created.id, { price: 19_999 });

      expect(updated.price).toBe(19_999);
      expect(updated.model).toBe('Corolla');
      expect(updated.quantity).toBe(4);
    });

    it('can change the stock quantity', () => {
      const created = service.create(corolla);
      expect(service.update(created.id, { quantity: 0 }).quantity).toBe(0);
    });

    it('throws NotFoundError for an unknown id', () => {
      expect(() => service.update('nope', { price: 1 })).toThrow(NotFoundError);
    });

    it('rejects an empty patch', () => {
      const created = service.create(corolla);
      expect(() => service.update(created.id, {})).toThrow(/no fields/i);
    });

    it('refuses to rename a vehicle onto an existing make/model/year', () => {
      const created = service.create(corolla);
      service.create({ ...corolla, model: 'Camry' });

      expect(() => service.update(created.id, { model: 'Camry' })).toThrow(ConflictError);
    });
  });

  describe('remove', () => {
    it('deletes the vehicle', () => {
      const created = service.create(corolla);

      service.remove(created.id);

      expect(() => service.findById(created.id)).toThrow(NotFoundError);
    });

    it('throws NotFoundError when deleting twice', () => {
      const created = service.create(corolla);
      service.remove(created.id);

      expect(() => service.remove(created.id)).toThrow(NotFoundError);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      service.create(corolla);
      service.create({ ...corolla, model: 'RAV4', category: 'SUV', price: 32_000, quantity: 2 });
      service.create({
        make: 'Ford',
        model: 'F-150',
        category: 'TRUCK',
        year: 2023,
        price: 45_000,
        quantity: 0,
        description: 'Workhorse pickup',
      });
      service.create({
        make: 'Tesla',
        model: 'Model 3',
        category: 'ELECTRIC',
        year: 2024,
        price: 39_000,
        quantity: 1,
        description: 'Long range',
      });
    });

    it('returns everything with no filters, newest first', () => {
      const result = service.search({});

      expect(result.total).toBe(4);
      expect(result.items).toHaveLength(4);
    });

    it('filters by make, case-insensitively and partially', () => {
      expect(service.search({ make: 'toyo' }).total).toBe(2);
    });

    it('filters by model', () => {
      const result = service.search({ model: 'f-15' });

      expect(result.total).toBe(1);
      expect(result.items[0]?.model).toBe('F-150');
    });

    it('filters by category', () => {
      expect(service.search({ category: 'SUV' }).total).toBe(1);
      expect(service.search({ category: 'suv' }).total).toBe(1);
    });

    it('filters by a minimum price', () => {
      expect(service.search({ minPrice: 35_000 }).total).toBe(2);
    });

    it('filters by a maximum price', () => {
      expect(service.search({ maxPrice: 32_000 }).total).toBe(2);
    });

    it('filters by a price range', () => {
      const result = service.search({ minPrice: 30_000, maxPrice: 40_000 });

      expect(result.total).toBe(2);
      expect(result.items.map((v) => v.model).sort()).toEqual(['Model 3', 'RAV4']);
    });

    it('returns nothing for an impossible range instead of failing', () => {
      expect(service.search({ minPrice: 90_000, maxPrice: 95_000 }).items).toEqual([]);
    });

    it('combines filters with AND', () => {
      expect(service.search({ make: 'Toyota', category: 'SUV' }).total).toBe(1);
      expect(service.search({ make: 'Toyota', category: 'TRUCK' }).total).toBe(0);
    });

    it('matches a free-text query across make, model and description', () => {
      expect(service.search({ q: 'pickup' }).total).toBe(1);
      expect(service.search({ q: 'tesla' }).total).toBe(1);
      expect(service.search({ q: 'corolla' }).total).toBe(1);
    });

    it('can hide out-of-stock vehicles', () => {
      const result = service.search({ availableOnly: true });

      expect(result.total).toBe(3);
      expect(result.items.every((v) => v.quantity > 0)).toBe(true);
    });

    it('sorts by price ascending and descending', () => {
      const asc = service.search({ sort: 'price_asc' }).items.map((v) => v.price);
      const desc = service.search({ sort: 'price_desc' }).items.map((v) => v.price);

      expect(asc).toEqual([...asc].sort((a, b) => a - b));
      expect(desc).toEqual([...asc].reverse());
    });

    it('paginates and reports the unpaginated total', () => {
      const page1 = service.search({ page: 1, limit: 3, sort: 'price_asc' });
      const page2 = service.search({ page: 2, limit: 3, sort: 'price_asc' });

      expect(page1.items).toHaveLength(3);
      expect(page2.items).toHaveLength(1);
      expect(page2.total).toBe(4);
      expect(page1.items.map((v) => v.id)).not.toContain(page2.items[0]?.id);
    });

    it('treats a search term containing SQL wildcards literally', () => {
      // A bound parameter must not let "%" match everything.
      expect(service.search({ make: '%' }).total).toBe(0);
    });

    it('lists the distinct makes and categories in stock, for filter dropdowns', () => {
      const facets = service.facets();

      expect(facets.makes).toEqual(['Ford', 'Tesla', 'Toyota']);
      expect(facets.categories).toEqual(['ELECTRIC', 'SEDAN', 'SUV', 'TRUCK']);
    });
  });
});
