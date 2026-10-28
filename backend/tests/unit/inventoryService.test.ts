import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { createTestDatabase } from '../helpers/testDb.js';
import { VehicleRepository } from '../../src/repositories/vehicleRepository.js';
import { PurchaseRepository } from '../../src/repositories/purchaseRepository.js';
import { VehicleService } from '../../src/services/vehicleService.js';
import { InventoryService } from '../../src/services/inventoryService.js';
import { createTransactionRunner } from '../../src/db/transaction.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../src/utils/errors.js';
import type { Vehicle } from '../../src/types/index.js';

describe('InventoryService', () => {
  let db: Database;
  let cleanup: () => void;
  let vehicles: VehicleService;
  let purchases: PurchaseRepository;
  let inventory: InventoryService;
  let vehicle: Vehicle;
  let buyerId: string;

  beforeEach(() => {
    ({ db, cleanup } = createTestDatabase());

    const vehicleRepository = new VehicleRepository(db);
    purchases = new PurchaseRepository(db);
    vehicles = new VehicleService(vehicleRepository);
    inventory = new InventoryService(vehicleRepository, purchases, createTransactionRunner(db));

    vehicle = vehicles.create({
      make: 'Toyota',
      model: 'Corolla',
      category: 'SEDAN',
      year: 2022,
      price: 21_500,
      quantity: 3,
    });

    buyerId = 'buyer-1';
    db.prepare(
      'INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    ).run(buyerId, 'Casey', 'casey@example.com', 'hash', 'CUSTOMER');
  });

  afterEach(() => cleanup());

  describe('purchase', () => {
    it('decreases the stock by the purchased quantity', () => {
      const result = inventory.purchase(vehicle.id, buyerId, 2);

      expect(result.vehicle.quantity).toBe(1);
      expect(vehicles.findById(vehicle.id).quantity).toBe(1);
    });

    it('defaults to buying one', () => {
      expect(inventory.purchase(vehicle.id, buyerId).vehicle.quantity).toBe(2);
    });

    it('records the purchase in the ledger with the price paid', () => {
      const result = inventory.purchase(vehicle.id, buyerId, 2);

      expect(result.purchase).toMatchObject({
        vehicleId: vehicle.id,
        userId: buyerId,
        quantity: 2,
        unitPrice: 21_500,
        totalPrice: 43_000,
      });

      const history = purchases.findByUser(buyerId);
      expect(history).toHaveLength(1);
      expect(history[0]?.totalPrice).toBe(43_000);
    });

    it('keeps the price paid even if the listing price changes later', () => {
      inventory.purchase(vehicle.id, buyerId, 1);
      vehicles.update(vehicle.id, { price: 25_000 });

      expect(purchases.findByUser(buyerId)[0]?.unitPrice).toBe(21_500);
    });

    it('allows buying the entire remaining stock', () => {
      expect(inventory.purchase(vehicle.id, buyerId, 3).vehicle.quantity).toBe(0);
    });

    it('refuses to buy more than is in stock', () => {
      expect(() => inventory.purchase(vehicle.id, buyerId, 4)).toThrow(ConflictError);
      expect(vehicles.findById(vehicle.id).quantity).toBe(3);
    });

    it('refuses to buy a sold-out vehicle', () => {
      inventory.purchase(vehicle.id, buyerId, 3);

      expect(() => inventory.purchase(vehicle.id, buyerId, 1)).toThrow(/out of stock/i);
    });

    it('writes no ledger row when the purchase is refused', () => {
      expect(() => inventory.purchase(vehicle.id, buyerId, 99)).toThrow(ConflictError);
      expect(purchases.findByUser(buyerId)).toHaveLength(0);
    });

    it('never lets stock go negative, however many buyers compete for it', () => {
      // Two buyers both try for the last three cars; only the first can win.
      inventory.purchase(vehicle.id, buyerId, 3);

      expect(() => inventory.purchase(vehicle.id, buyerId, 1)).toThrow(ConflictError);
      expect(vehicles.findById(vehicle.id).quantity).toBe(0);
    });

    it('rejects a zero or negative quantity', () => {
      expect(() => inventory.purchase(vehicle.id, buyerId, 0)).toThrow(BadRequestError);
      expect(() => inventory.purchase(vehicle.id, buyerId, -1)).toThrow(BadRequestError);
    });

    it('rejects a fractional quantity', () => {
      expect(() => inventory.purchase(vehicle.id, buyerId, 1.5)).toThrow(BadRequestError);
    });

    it('throws NotFoundError for an unknown vehicle', () => {
      expect(() => inventory.purchase('no-such-car', buyerId, 1)).toThrow(NotFoundError);
    });
  });

  describe('restock', () => {
    it('increases the stock', () => {
      expect(inventory.restock(vehicle.id, 5).quantity).toBe(8);
    });

    it('brings a sold-out vehicle back on sale', () => {
      inventory.purchase(vehicle.id, buyerId, 3);

      const restocked = inventory.restock(vehicle.id, 2);

      expect(restocked.quantity).toBe(2);
      expect(() => inventory.purchase(vehicle.id, buyerId, 1)).not.toThrow();
    });

    it('rejects a zero or negative quantity', () => {
      expect(() => inventory.restock(vehicle.id, 0)).toThrow(BadRequestError);
      expect(() => inventory.restock(vehicle.id, -3)).toThrow(BadRequestError);
    });

    it('throws NotFoundError for an unknown vehicle', () => {
      expect(() => inventory.restock('no-such-car', 1)).toThrow(NotFoundError);
    });
  });

  describe('purchase history', () => {
    it("returns a buyer's purchases, newest first, with the vehicle attached", () => {
      const suv = vehicles.create({
        make: 'Toyota',
        model: 'RAV4',
        category: 'SUV',
        year: 2023,
        price: 32_000,
        quantity: 1,
      });

      inventory.purchase(vehicle.id, buyerId, 1);
      inventory.purchase(suv.id, buyerId, 1);

      const history = inventory.historyFor(buyerId);

      expect(history).toHaveLength(2);
      expect(history.map((entry) => entry.vehicle?.model)).toContain('RAV4');
    });

    it('returns an empty list for a buyer who has bought nothing', () => {
      expect(inventory.historyFor('someone-else')).toEqual([]);
    });
  });
});
