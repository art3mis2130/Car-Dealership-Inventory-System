/** Mirrors the backend's domain types. Kept in one file so drift is obvious. */

export type Role = 'ADMIN' | 'CUSTOMER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
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
  vehicle: Pick<Vehicle, 'id' | 'make' | 'model' | 'category' | 'year'> | null;
}

export interface SearchMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface VehicleFilters {
  q?: string;
  make?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  availableOnly?: boolean;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'year_desc';
  page?: number;
  limit?: number;
}

export interface VehicleInput {
  make: string;
  model: string;
  category: string;
  // Optional on the wire: a blank numeric field is sent as missing, so the
  // server's "required" rule fires instead of a silent zero.
  year?: number;
  price?: number;
  quantity?: number;
  description?: string | null;
  imageUrl?: string | null;
}

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
