import type { Database } from 'better-sqlite3';
import { UserRepository } from './repositories/userRepository.js';
import { VehicleRepository } from './repositories/vehicleRepository.js';
import { PurchaseRepository } from './repositories/purchaseRepository.js';
import { AuthService } from './services/authService.js';
import { VehicleService } from './services/vehicleService.js';
import { InventoryService } from './services/inventoryService.js';
import { AuthController } from './controllers/authController.js';
import { VehicleController } from './controllers/vehicleController.js';
import { HealthController } from './controllers/healthController.js';
import { createTransactionRunner } from './db/transaction.js';

/**
 * Composition root.
 *
 * Wiring happens exactly once, here, from a single database handle. Every
 * class below receives its collaborators through its constructor, so no module
 * reaches for a global - and a test can build the whole graph against a
 * throwaway database by calling this with a different handle.
 */
export interface Container {
  authController: AuthController;
  vehicleController: VehicleController;
  healthController: HealthController;
  userRepository: UserRepository;
}

export function buildContainer(db: Database): Container {
  const transaction = createTransactionRunner(db);

  const userRepository = new UserRepository(db);
  const vehicleRepository = new VehicleRepository(db);
  const purchaseRepository = new PurchaseRepository(db);

  const authService = new AuthService(userRepository);
  const vehicleService = new VehicleService(vehicleRepository);
  const inventoryService = new InventoryService(vehicleRepository, purchaseRepository, transaction);

  return {
    userRepository,
    authController: new AuthController(authService, userRepository),
    vehicleController: new VehicleController(vehicleService, inventoryService),
    healthController: new HealthController(db),
  };
}
