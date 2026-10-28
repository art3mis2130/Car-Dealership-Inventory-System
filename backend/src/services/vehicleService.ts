import { randomUUID } from 'node:crypto';
import type { PaginatedVehicles, VehicleRepository } from '../repositories/vehicleRepository.js';
import type { Vehicle } from '../types/index.js';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors.js';
import type {
  CreateVehicleInput,
  SearchVehiclesCriteria,
  UpdateVehicleInput,
} from '../validation/vehicleSchemas.js';

/**
 * Catalogue rules: what makes a listing valid, unique and findable.
 *
 * Stock movements (purchase/restock) deliberately live in InventoryService
 * instead - this class is about the listing, that one is about the ledger.
 */
export class VehicleService {
  constructor(private readonly vehicles: VehicleRepository) {}

  create(input: CreateVehicleInput): Vehicle {
    const make = input.make.trim();
    const model = input.model.trim();

    this.assertIdentityAvailable(make, model, input.year);

    return this.vehicles.create({
      id: randomUUID(),
      make,
      model,
      category: input.category,
      year: input.year,
      price: input.price,
      quantity: input.quantity,
      description: input.description?.trim() ?? null,
      imageUrl: input.imageUrl ?? null,
    });
  }

  findById(id: string): Vehicle {
    const vehicle = this.vehicles.findById(id);
    if (!vehicle) throw new NotFoundError(`No vehicle with id ${id}`);

    return vehicle;
  }

  update(id: string, patch: UpdateVehicleInput): Vehicle {
    if (Object.keys(patch).length === 0) {
      throw new BadRequestError('Provide at least one field to update - no fields were given');
    }

    const existing = this.findById(id);

    // A patch may rename a vehicle onto another listing's identity; check the
    // merged result, not just the fields that were sent.
    const make = patch.make?.trim() ?? existing.make;
    const model = patch.model?.trim() ?? existing.model;
    const year = patch.year ?? existing.year;

    if (make !== existing.make || model !== existing.model || year !== existing.year) {
      this.assertIdentityAvailable(make, model, year, id);
    }

    const updated = this.vehicles.update(id, {
      ...patch,
      ...(patch.make !== undefined ? { make } : {}),
      ...(patch.model !== undefined ? { model } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description?.trim() ?? null }
        : {}),
      ...(patch.imageUrl !== undefined ? { imageUrl: patch.imageUrl ?? null } : {}),
    });

    if (!updated) throw new NotFoundError(`No vehicle with id ${id}`);

    return updated;
  }

  remove(id: string): void {
    if (!this.vehicles.delete(id)) {
      throw new NotFoundError(`No vehicle with id ${id}`);
    }
  }

  search(criteria: SearchVehiclesCriteria): PaginatedVehicles {
    return this.vehicles.search(criteria);
  }

  facets(): { makes: string[]; categories: string[] } {
    return this.vehicles.facets();
  }

  /** Guards the make/model/year natural key, optionally ignoring one row. */
  private assertIdentityAvailable(
    make: string,
    model: string,
    year: number,
    ignoreId?: string,
  ): void {
    const clash = this.vehicles.findByIdentity(make, model, year);

    if (clash && clash.id !== ignoreId) {
      throw new ConflictError(
        `${year} ${make} ${model} is already listed - restock it instead of adding a duplicate`,
      );
    }
  }
}
