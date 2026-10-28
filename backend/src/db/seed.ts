import { randomUUID } from 'node:crypto';
import { getEnv } from '../config/env.js';
import { openDatabase } from './index.js';
import { UserRepository } from '../repositories/userRepository.js';
import { VehicleRepository } from '../repositories/vehicleRepository.js';
import { VehicleService } from '../services/vehicleService.js';
import { hashPassword } from '../utils/password.js';
import { ConflictError } from '../utils/errors.js';
import type { CreateVehicleInput } from '../validation/vehicleSchemas.js';

/**
 * `npm run seed` - gives a fresh checkout something to look at.
 *
 * Idempotent: running it twice adds nothing new, so it is safe to re-run
 * after pulling. Admins are created here rather than through the public
 * registration endpoint, which can only ever mint customers.
 */
const SAMPLE_VEHICLES: CreateVehicleInput[] = [
  {
    make: 'Toyota',
    model: 'Corolla',
    category: 'SEDAN',
    year: 2023,
    price: 21_500,
    quantity: 6,
    description: 'The sensible choice. Frugal, unbreakable, and quietly good to drive.',
  },
  {
    make: 'Toyota',
    model: 'RAV4 Hybrid',
    category: 'SUV',
    year: 2024,
    price: 34_900,
    quantity: 3,
    description: 'Family-sized hybrid with all-wheel drive and a very large boot.',
  },
  {
    make: 'Honda',
    model: 'Civic',
    category: 'HATCHBACK',
    year: 2023,
    price: 24_250,
    quantity: 4,
    description: 'Sharp handling, excellent visibility, famously reliable.',
  },
  {
    make: 'Ford',
    model: 'F-150 Lightning',
    category: 'TRUCK',
    year: 2024,
    price: 58_000,
    quantity: 2,
    description: 'Electric pickup that can power a house for three days.',
  },
  {
    make: 'Tesla',
    model: 'Model 3 Long Range',
    category: 'ELECTRIC',
    year: 2025,
    price: 42_990,
    quantity: 5,
    description: '560 km of range, over-the-air updates, minimal interior.',
  },
  {
    make: 'Mazda',
    model: 'MX-5',
    category: 'CONVERTIBLE',
    year: 2024,
    price: 31_750,
    quantity: 2,
    description: 'Two seats, rear-wheel drive, roof down. Nothing else required.',
  },
  {
    make: 'BMW',
    model: '430i Coupe',
    category: 'COUPE',
    year: 2024,
    price: 54_400,
    quantity: 1,
    description: 'Straight-six smoothness with a controversial grille.',
  },
  {
    make: 'Volkswagen',
    model: 'ID. Buzz',
    category: 'VAN',
    year: 2025,
    price: 49_900,
    quantity: 0,
    description: 'Electric microbus. Sold out - restock to put it back on sale.',
  },
  {
    make: 'Hyundai',
    model: 'Ioniq 5',
    category: 'ELECTRIC',
    year: 2024,
    price: 39_600,
    quantity: 4,
    description: '800-volt charging, flat floor, retro-futurist styling.',
  },
  {
    make: 'Subaru',
    model: 'Outback',
    category: 'SUV',
    year: 2023,
    price: 33_100,
    quantity: 3,
    description: 'Estate on stilts. Will go further off-road than you expect.',
  },
  {
    make: 'Kia',
    model: 'Picanto',
    category: 'HATCHBACK',
    year: 2023,
    price: 14_300,
    quantity: 8,
    description: 'City runabout with a long warranty and a tiny turning circle.',
  },
  {
    make: 'Porsche',
    model: '911 Carrera',
    category: 'COUPE',
    year: 2025,
    price: 128_500,
    quantity: 1,
    description: 'The one on the showroom turntable. Looks good from every angle.',
  },
];

/**
 * Seeds an already-open database. Exported so the server can call it on first
 * boot (SEED_ON_START), which is how a container with an empty volume ends up
 * with something to show without anyone running a one-off command against it.
 */
export async function seedDatabase(db: ReturnType<typeof openDatabase>): Promise<void> {
  const env = getEnv();

  const users = new UserRepository(db);
  const vehicles = new VehicleService(new VehicleRepository(db));

  const adminEmail = env.SEED_ADMIN_EMAIL.toLowerCase();

  if (users.existsByEmail(adminEmail)) {
    console.log(`Admin ${adminEmail} already exists, leaving it alone.`);
  } else {
    users.create({
      id: randomUUID(),
      name: 'Dealership Admin',
      email: adminEmail,
      passwordHash: await hashPassword(env.SEED_ADMIN_PASSWORD),
      role: 'ADMIN',
    });
    console.log(`Created admin ${adminEmail} (password from SEED_ADMIN_PASSWORD).`);
  }

  const demoEmail = 'customer@dealership.test';

  if (!users.existsByEmail(demoEmail)) {
    users.create({
      id: randomUUID(),
      name: 'Casey Customer',
      email: demoEmail,
      passwordHash: await hashPassword('Customer123!'),
      role: 'CUSTOMER',
    });
    console.log(`Created demo customer ${demoEmail} (password Customer123!).`);
  }

  let added = 0;

  for (const vehicle of SAMPLE_VEHICLES) {
    try {
      vehicles.create(vehicle);
      added += 1;
    } catch (error) {
      // Already listed from an earlier run - that is the idempotent path.
      if (!(error instanceof ConflictError)) throw error;
    }
  }

  console.log(`Added ${added} vehicle(s); ${SAMPLE_VEHICLES.length - added} already present.`);
}

/** `npm run seed` - opens the configured database, seeds it, closes it. */
async function main(): Promise<void> {
  const db = openDatabase(getEnv().DATABASE_PATH);

  try {
    await seedDatabase(db);
  } finally {
    db.close();
  }
}

// Only run as a script, not when the server imports seedDatabase.
if (process.argv[1]?.includes('seed')) {
  main().catch((error: unknown) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
}
