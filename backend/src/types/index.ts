/** Roles the system recognises. Registration can only ever produce CUSTOMER. */
export const ROLES = ['ADMIN', 'CUSTOMER'] as const;
export type Role = (typeof ROLES)[number];

/** A user as the rest of the application sees it: never with a password hash. */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

/** Internal shape, used only where credentials genuinely have to be checked. */
export interface UserWithCredentials extends PublicUser {
  passwordHash: string;
}

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  category: string;
  year: number;
  price: number;
  quantity: number;
  description: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Purchase {
  id: string;
  vehicleId: string;
  userId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  purchasedAt: string;
}

/** Vehicle categories offered by the dealership. */
export const VEHICLE_CATEGORIES = [
  'SEDAN',
  'SUV',
  'HATCHBACK',
  'TRUCK',
  'COUPE',
  'CONVERTIBLE',
  'VAN',
  'ELECTRIC',
] as const;
export type VehicleCategory = (typeof VEHICLE_CATEGORIES)[number];
