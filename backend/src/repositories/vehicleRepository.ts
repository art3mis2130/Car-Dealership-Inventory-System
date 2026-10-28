import type { Database } from 'better-sqlite3';
import type { Vehicle } from '../types/index.js';
import type { SearchVehiclesCriteria } from '../validation/vehicleSchemas.js';

interface VehicleRow {
  id: string;
  make: string;
  model: string;
  category: string;
  year: number;
  price: number;
  quantity: number;
  description: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateVehicleRecord {
  id: string;
  make: string;
  model: string;
  category: string;
  year: number;
  price: number;
  quantity: number;
  description: string | null;
  imageUrl: string | null;
}

export interface PaginatedVehicles {
  items: Vehicle[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Sort option to ORDER BY clause. A whitelist, never interpolated user input. */
const SORT_CLAUSES: Record<string, string> = {
  newest: 'created_at DESC, rowid DESC',
  oldest: 'created_at ASC, rowid ASC',
  price_asc: 'price ASC, rowid ASC',
  price_desc: 'price DESC, rowid DESC',
  year_desc: 'year DESC, rowid DESC',
  year_asc: 'year ASC, rowid ASC',
};

/** Every piece of vehicles SQL lives here. */
export class VehicleRepository {
  constructor(private readonly db: Database) {}

  create(record: CreateVehicleRecord): Vehicle {
    this.db
      .prepare(
        `INSERT INTO vehicles (id, make, model, category, year, price, quantity, description, image_url)
         VALUES (@id, @make, @model, @category, @year, @price, @quantity, @description, @imageUrl)`,
      )
      .run(record);

    const created = this.findById(record.id);
    if (!created) throw new Error(`Vehicle ${record.id} vanished immediately after insert`);

    return created;
  }

  findById(id: string): Vehicle | null {
    const row = this.db
      .prepare<[string], VehicleRow>('SELECT * FROM vehicles WHERE id = ?')
      .get(id);
    return row ? toVehicle(row) : null;
  }

  /**
   * Finds a vehicle by its natural key (make + model + year), ignoring case.
   * Used to keep the same model-year from being listed twice.
   */
  findByIdentity(make: string, model: string, year: number): Vehicle | null {
    const row = this.db
      .prepare<[string, string, number], VehicleRow>(
        `SELECT * FROM vehicles
         WHERE lower(make) = lower(?) AND lower(model) = lower(?) AND year = ?`,
      )
      .get(make, model, year);

    return row ? toVehicle(row) : null;
  }

  /**
   * Applies a partial update.
   *
   * The SET clause is assembled from a fixed whitelist of column names and the
   * values are always bound, so no caller-supplied string reaches the SQL text.
   */
  update(id: string, patch: Partial<CreateVehicleRecord>): Vehicle | null {
    // Domain field -> column name. A fixed map, so nothing a caller sends can
    // influence the SQL text; only the values are ever bound.
    const COLUMNS: Record<keyof Omit<CreateVehicleRecord, 'id'>, string> = {
      make: 'make',
      model: 'model',
      category: 'category',
      year: 'year',
      price: 'price',
      quantity: 'quantity',
      description: 'description',
      imageUrl: 'image_url',
    };

    const assignments: string[] = [];
    const params: Record<string, unknown> = { id };

    for (const [field, column] of Object.entries(COLUMNS) as [
      keyof Omit<CreateVehicleRecord, 'id'>,
      string,
    ][]) {
      if (patch[field] !== undefined) {
        assignments.push(`${column} = @${field}`);
        params[field] = patch[field];
      }
    }

    if (assignments.length === 0) return this.findById(id);

    const result = this.db
      .prepare(
        `UPDATE vehicles
            SET ${assignments.join(', ')}, updated_at = datetime('now')
          WHERE id = @id`,
      )
      .run(params);

    return result.changes === 0 ? null : this.findById(id);
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM vehicles WHERE id = ?').run(id).changes > 0;
  }

  /**
   * Filtered, sorted, paginated search.
   *
   * Conditions are collected into an array and joined with AND, which keeps
   * one code path for "no filters" and "every filter" alike.
   */
  search(criteria: SearchVehiclesCriteria): PaginatedVehicles {
    const page = criteria.page ?? 1;
    const limit = criteria.limit ?? 12;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (criteria.q) {
      conditions.push(
        `(make LIKE ? ESCAPE '\\' OR model LIKE ? ESCAPE '\\' OR category LIKE ? ESCAPE '\\'
          OR IFNULL(description, '') LIKE ? ESCAPE '\\')`,
      );
      const pattern = containsPattern(criteria.q);
      params.push(pattern, pattern, pattern, pattern);
    }

    if (criteria.make) {
      conditions.push(`make LIKE ? ESCAPE '\\'`);
      params.push(containsPattern(criteria.make));
    }

    if (criteria.model) {
      conditions.push(`model LIKE ? ESCAPE '\\'`);
      params.push(containsPattern(criteria.model));
    }

    if (criteria.category) {
      conditions.push('lower(category) = lower(?)');
      params.push(criteria.category);
    }

    if (criteria.minPrice !== undefined) {
      conditions.push('price >= ?');
      params.push(criteria.minPrice);
    }

    if (criteria.maxPrice !== undefined) {
      conditions.push('price <= ?');
      params.push(criteria.maxPrice);
    }

    if (criteria.minYear !== undefined) {
      conditions.push('year >= ?');
      params.push(criteria.minYear);
    }

    if (criteria.maxYear !== undefined) {
      conditions.push('year <= ?');
      params.push(criteria.maxYear);
    }

    if (criteria.availableOnly) {
      conditions.push('quantity > 0');
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderBy = SORT_CLAUSES[criteria.sort ?? 'newest'] ?? SORT_CLAUSES.newest;

    const totalRow = this.db
      .prepare<unknown[], { total: number }>(`SELECT COUNT(*) AS total FROM vehicles ${where}`)
      .get(...params);
    const total = totalRow?.total ?? 0;

    const rows = this.db
      .prepare<unknown[], VehicleRow>(
        `SELECT * FROM vehicles ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, (page - 1) * limit);

    return {
      items: rows.map(toVehicle),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /** Distinct makes and categories currently listed, for the filter dropdowns. */
  facets(): { makes: string[]; categories: string[] } {
    const makes = this.db
      .prepare<[], { make: string }>(
        'SELECT DISTINCT make FROM vehicles ORDER BY make COLLATE NOCASE',
      )
      .all()
      .map((row) => row.make);

    const categories = this.db
      .prepare<[], { category: string }>(
        'SELECT DISTINCT category FROM vehicles ORDER BY category COLLATE NOCASE',
      )
      .all()
      .map((row) => row.category);

    return { makes, categories };
  }

  /**
   * Atomically decrements stock, refusing to go below zero.
   *
   * The guard lives in the WHERE clause rather than in a read-then-write pair,
   * so two concurrent purchases of the last car cannot both succeed.
   */
  decrementStock(id: string, quantity: number): boolean {
    return (
      this.db
        .prepare(
          "UPDATE vehicles SET quantity = quantity - ?, updated_at = datetime('now') WHERE id = ? AND quantity >= ?",
        )
        .run(quantity, id, quantity).changes > 0
    );
  }

  /** Atomically increments stock. */
  incrementStock(id: string, quantity: number): boolean {
    return (
      this.db
        .prepare(
          "UPDATE vehicles SET quantity = quantity + ?, updated_at = datetime('now') WHERE id = ?",
        )
        .run(quantity, id).changes > 0
    );
  }
}

function toVehicle(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    category: row.category,
    year: row.year,
    price: row.price,
    quantity: row.quantity,
    description: row.description,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Builds a "contains" LIKE pattern, escaping the wildcards a user may have
 * typed. Without this, searching for "%" would match the entire inventory.
 */
function containsPattern(term: string): string {
  const escaped = term.replace(/[\\%_]/g, (char) => `\\${char}`);
  return `%${escaped}%`;
}
