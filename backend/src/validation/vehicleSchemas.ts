import { z } from 'zod';
import { VEHICLE_CATEGORIES } from '../types/index.js';

const currentYear = new Date().getFullYear();

/** Categories are a closed set so the UI can offer a reliable filter list. */
const categorySchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(
    z.enum(VEHICLE_CATEGORIES, {
      message: `Category must be one of: ${VEHICLE_CATEGORIES.join(', ')}`,
    }),
  );

/**
 * A photo URL ends up in an <img src>, so the scheme is restricted to http(s)
 * rather than trusting whatever an admin pastes in. z.string().url() alone
 * would happily accept javascript: and data: URLs.
 */
const imageUrlSchema = z
  .string()
  .trim()
  .max(500)
  .url('Must be a valid URL')
  .refine(
    (value) => value.startsWith('http://') || value.startsWith('https://'),
    'Image URL must start with http:// or https://',
  )
  .optional()
  .nullable();

/**
 * A required numeric field that reports itself properly when it is missing.
 *
 * `z.coerce.number()` runs Number() on everything, so an absent value becomes
 * NaN and the user is told "Expected number, received nan" instead of "Price
 * is required". Preprocessing leaves undefined alone - so required_error
 * fires - while still accepting the strings that arrive over HTTP.
 */
function requiredNumber(
  messages: { required: string; invalid: string },
  // Typed as ZodNumber rather than ZodTypeAny on purpose: z.preprocess takes
  // its output type from this, and ZodTypeAny would hand every caller `any`.
  constrain: (base: z.ZodNumber) => z.ZodNumber,
) {
  const base = z.number({
    required_error: messages.required,
    invalid_type_error: messages.invalid,
  });

  return z.preprocess((value) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'string' && value.trim() === '') return undefined;

    return typeof value === 'number' ? value : Number(value);
  }, constrain(base));
}

export const createVehicleSchema = z.object({
  make: z.string({ required_error: 'Make is required' }).trim().min(1, 'Make is required').max(60),
  model: z
    .string({ required_error: 'Model is required' })
    .trim()
    .min(1, 'Model is required')
    .max(60),
  category: categorySchema,
  year: requiredNumber({ required: 'Year is required', invalid: 'Year must be a number' }, (n) =>
    n
      .int('Year must be a whole number')
      .min(1900, 'Year must be 1900 or later')
      .max(currentYear + 2, `Year cannot be later than ${currentYear + 2}`),
  ),
  price: requiredNumber({ required: 'Price is required', invalid: 'Price must be a number' }, (n) =>
    n.nonnegative('Price cannot be negative').max(100_000_000, 'Price is unrealistically high'),
  ),
  quantity: requiredNumber(
    { required: 'Quantity is required', invalid: 'Quantity must be a number' },
    (n) =>
      n
        .int('Quantity must be a whole number')
        .nonnegative('Quantity cannot be negative')
        .max(100_000),
  ),
  description: z.string().trim().max(500).optional().nullable(),
  imageUrl: imageUrlSchema,
});

/**
 * Updates are a partial of create, but an empty body is rejected: PUT with
 * nothing to change is a client mistake, not a no-op.
 */
export const updateVehicleSchema = createVehicleSchema
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'Provide at least one field to update',
  });

const SORT_OPTIONS = [
  'newest',
  'oldest',
  'price_asc',
  'price_desc',
  'year_desc',
  'year_asc',
] as const;

export const searchVehiclesSchema = z.object({
  q: z.string().trim().max(120).optional(),
  make: z.string().trim().max(60).optional(),
  model: z.string().trim().max(60).optional(),
  // Category is a free string here (not the enum) so an unknown value simply
  // matches nothing instead of 422-ing a browsing user.
  category: z.string().trim().max(40).optional(),
  minPrice: z.coerce.number().nonnegative('minPrice cannot be negative').optional(),
  maxPrice: z.coerce.number().nonnegative('maxPrice cannot be negative').optional(),
  minYear: z.coerce.number().int().min(1900).optional(),
  maxYear: z.coerce
    .number()
    .int()
    .max(currentYear + 2)
    .optional(),
  availableOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((value) => value === true || value === 'true')
    .optional(),
  sort: z.enum(SORT_OPTIONS).default('newest'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100, 'limit cannot exceed 100').default(12),
});

export const purchaseSchema = z.object({
  quantity: z.coerce.number().int().positive('Quantity must be at least 1').max(100).default(1),
});

export const restockSchema = z.object({
  quantity: requiredNumber(
    { required: 'Quantity is required', invalid: 'Quantity must be a number' },
    (n) =>
      n.int('Quantity must be a whole number').positive('Quantity must be at least 1').max(10_000),
  ),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type SearchVehiclesQuery = z.infer<typeof searchVehiclesSchema>;
export type SearchVehiclesCriteria = Partial<SearchVehiclesQuery>;
