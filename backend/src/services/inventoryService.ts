import { randomUUID } from 'node:crypto';
import type { TransactionRunner } from '../db/transaction.js';
import type {
  PurchaseRepository,
  PurchaseWithVehicle,
} from '../repositories/purchaseRepository.js';
import type { VehicleRepository } from '../repositories/vehicleRepository.js';
import type { Purchase, Vehicle } from '../types/index.js';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors.js';

export interface PurchaseResult {
  purchase: Purchase;
  vehicle: Vehicle;
}

/**
 * Stock movements.
 *
 * Separate from VehicleService on purpose: that class owns what a listing is,
 * this one owns how stock moves and keeps the ledger honest. The two have
 * different reasons to change, so they are different classes.
 */
export class InventoryService {
  constructor(
    private readonly vehicles: VehicleRepository,
    private readonly purchases: PurchaseRepository,
    private readonly transaction: TransactionRunner,
  ) {}

  /**
   * Sells `quantity` units of a vehicle to a user.
   *
   * The decrement and the ledger entry run in one transaction, and the stock
   * guard is part of the UPDATE's WHERE clause rather than a separate read.
   * That combination is what makes overselling impossible: if two buyers race
   * for the last car, exactly one UPDATE reports a changed row.
   */
  purchase(vehicleId: string, userId: string, quantity = 1): PurchaseResult {
    assertPositiveWholeNumber(quantity, 'Purchase quantity');

    const vehicle = this.requireVehicle(vehicleId);

    if (vehicle.quantity === 0) {
      throw new ConflictError(`${vehicle.year} ${vehicle.make} ${vehicle.model} is out of stock`);
    }

    if (vehicle.quantity < quantity) {
      throw new ConflictError(
        `Only ${vehicle.quantity} left in stock, cannot purchase ${quantity}`,
      );
    }

    return this.transaction(() => {
      if (!this.vehicles.decrementStock(vehicleId, quantity)) {
        // Lost a race against another buyer between the read and the update.
        throw new ConflictError('That vehicle was just sold - please refresh and try again');
      }

      const purchase = this.purchases.create({
        id: randomUUID(),
        vehicleId,
        userId,
        quantity,
        // Snapshot the price: the ledger records what was paid, not what the
        // listing happens to cost today.
        unitPrice: vehicle.price,
        totalPrice: round2(vehicle.price * quantity),
      });

      const updated = this.vehicles.findById(vehicleId);
      if (!updated) throw new NotFoundError(`No vehicle with id ${vehicleId}`);

      return { purchase, vehicle: updated };
    });
  }

  /** Adds stock back onto the lot (admin only, enforced at the route). */
  restock(vehicleId: string, quantity: number): Vehicle {
    assertPositiveWholeNumber(quantity, 'Restock quantity');

    this.requireVehicle(vehicleId);

    if (!this.vehicles.incrementStock(vehicleId, quantity)) {
      throw new NotFoundError(`No vehicle with id ${vehicleId}`);
    }

    const updated = this.vehicles.findById(vehicleId);
    if (!updated) throw new NotFoundError(`No vehicle with id ${vehicleId}`);

    return updated;
  }

  historyFor(userId: string): PurchaseWithVehicle[] {
    return this.purchases.findByUserWithVehicle(userId);
  }

  private requireVehicle(vehicleId: string): Vehicle {
    const vehicle = this.vehicles.findById(vehicleId);
    if (!vehicle) throw new NotFoundError(`No vehicle with id ${vehicleId}`);

    return vehicle;
  }
}

function assertPositiveWholeNumber(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new BadRequestError(`${label} must be a whole number of at least 1`);
  }
}

/** Money is stored as a REAL, so round to cents to avoid float drift. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
