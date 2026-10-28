import type { Database } from 'better-sqlite3';
import type { Purchase, Vehicle } from '../types/index.js';

interface PurchaseRow {
  id: string;
  vehicle_id: string;
  user_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  purchased_at: string;
}

/** A purchase joined with the vehicle it was for, for the "my purchases" view. */
export interface PurchaseWithVehicle extends Purchase {
  vehicle: Pick<Vehicle, 'id' | 'make' | 'model' | 'category' | 'year'> | null;
}

export interface CreatePurchaseRecord {
  id: string;
  vehicleId: string;
  userId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

/** The purchase ledger: an append-only record of stock leaving the lot. */
export class PurchaseRepository {
  constructor(private readonly db: Database) {}

  create(record: CreatePurchaseRecord): Purchase {
    this.db
      .prepare(
        `INSERT INTO purchases (id, vehicle_id, user_id, quantity, unit_price, total_price)
         VALUES (@id, @vehicleId, @userId, @quantity, @unitPrice, @totalPrice)`,
      )
      .run(record);

    const created = this.db
      .prepare<[string], PurchaseRow>('SELECT * FROM purchases WHERE id = ?')
      .get(record.id);

    if (!created) throw new Error(`Purchase ${record.id} vanished immediately after insert`);

    return toPurchase(created);
  }

  findByUser(userId: string): Purchase[] {
    return this.db
      .prepare<[string], PurchaseRow>(
        'SELECT * FROM purchases WHERE user_id = ? ORDER BY purchased_at DESC, rowid DESC',
      )
      .all(userId)
      .map(toPurchase);
  }

  /**
   * History with the vehicle details attached.
   *
   * LEFT JOIN, not JOIN: a vehicle may have been delisted since, and a buyer
   * should still see what they bought.
   */
  findByUserWithVehicle(userId: string): PurchaseWithVehicle[] {
    const rows = this.db
      .prepare<
        [string],
        PurchaseRow & {
          v_id: string | null;
          v_make: string | null;
          v_model: string | null;
          v_category: string | null;
          v_year: number | null;
        }
      >(
        `SELECT p.*,
                v.id       AS v_id,
                v.make     AS v_make,
                v.model    AS v_model,
                v.category AS v_category,
                v.year     AS v_year
           FROM purchases p
           LEFT JOIN vehicles v ON v.id = p.vehicle_id
          WHERE p.user_id = ?
          ORDER BY p.purchased_at DESC, p.rowid DESC`,
      )
      .all(userId);

    return rows.map((row) => ({
      ...toPurchase(row),
      vehicle:
        row.v_id && row.v_make && row.v_model && row.v_category && row.v_year !== null
          ? {
              id: row.v_id,
              make: row.v_make,
              model: row.v_model,
              category: row.v_category,
              year: row.v_year,
            }
          : null,
    }));
  }

  countForVehicle(vehicleId: string): number {
    const row = this.db
      .prepare<[string], { count: number }>(
        'SELECT COUNT(*) AS count FROM purchases WHERE vehicle_id = ?',
      )
      .get(vehicleId);

    return row?.count ?? 0;
  }
}

function toPurchase(row: PurchaseRow): Purchase {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    userId: row.user_id,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    totalPrice: row.total_price,
    purchasedAt: row.purchased_at,
  };
}
