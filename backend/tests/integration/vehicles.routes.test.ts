import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  createTestContext,
  registerAdmin,
  registerCustomer,
  type TestContext,
} from '../helpers/testApp.js';

const newVehicle = {
  make: 'Toyota',
  model: 'Corolla',
  category: 'SEDAN',
  year: 2022,
  price: 21500,
  quantity: 3,
  description: 'Reliable commuter',
};

describe('vehicle endpoints', () => {
  let ctx: TestContext;
  let adminToken: string;
  let customerToken: string;

  beforeEach(async () => {
    ctx = createTestContext();
    adminToken = (await registerAdmin(ctx.app, ctx.db)).token;
    customerToken = (await registerCustomer(ctx.app)).token;
  });

  afterEach(() => ctx.cleanup());

  /** Adds a vehicle as the admin and returns its id. */
  const seed = async (overrides: Partial<typeof newVehicle> = {}): Promise<string> => {
    const response = await request(ctx.app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...newVehicle, ...overrides })
      .expect(201);

    return response.body.data.vehicle.id;
  };

  describe('POST /api/vehicles', () => {
    it('lets an admin add a vehicle and returns 201', async () => {
      const response = await request(ctx.app)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newVehicle);

      expect(response.status).toBe(201);
      expect(response.body.data.vehicle).toMatchObject({
        make: 'Toyota',
        model: 'Corolla',
        category: 'SEDAN',
        price: 21500,
        quantity: 3,
      });
      expect(response.body.data.vehicle.id).toBeTypeOf('string');
    });

    it('returns 401 without a token', async () => {
      const response = await request(ctx.app).post('/api/vehicles').send(newVehicle);
      expect(response.status).toBe(401);
    });

    it('returns 403 for a customer', async () => {
      const response = await request(ctx.app)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(newVehicle);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 409 for a duplicate make/model/year', async () => {
      await seed();

      const response = await request(ctx.app)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newVehicle);

      expect(response.status).toBe(409);
    });

    it.each([
      ['a negative price', { price: -1 }],
      ['a negative quantity', { quantity: -2 }],
      ['a fractional quantity', { quantity: 1.5 }],
      ['an unknown category', { category: 'SPACESHIP' }],
      ['a year before 1900', { year: 1800 }],
      ['a missing make', { make: undefined }],
    ])('returns 422 for %s', async (_label, patch) => {
      const response = await request(ctx.app)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...newVehicle, ...patch });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('accepts a lower-case category and normalises it', async () => {
      const response = await request(ctx.app)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...newVehicle, category: 'sedan' });

      expect(response.status).toBe(201);
      expect(response.body.data.vehicle.category).toBe('SEDAN');
    });
  });

  describe('GET /api/vehicles', () => {
    it('lists vehicles for any signed-in user, with pagination metadata', async () => {
      await seed();
      await seed({ model: 'RAV4', category: 'SUV', price: 32000 });

      const response = await request(ctx.app)
        .get('/api/vehicles')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.vehicles).toHaveLength(2);
      expect(response.body.meta).toMatchObject({ total: 2, page: 1 });
    });

    it('returns an empty list rather than a 404 when nothing is listed', async () => {
      const response = await request(ctx.app)
        .get('/api/vehicles')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.vehicles).toEqual([]);
      expect(response.body.meta.total).toBe(0);
    });

    it('returns 401 without a token', async () => {
      expect((await request(ctx.app).get('/api/vehicles')).status).toBe(401);
    });
  });

  describe('GET /api/vehicles/search', () => {
    beforeEach(async () => {
      await seed();
      await seed({ model: 'RAV4', category: 'SUV', price: 32000 });
      await seed({ make: 'Ford', model: 'F-150', category: 'TRUCK', price: 45000, quantity: 0 });
    });

    it('searches by make', async () => {
      const response = await request(ctx.app)
        .get('/api/vehicles/search')
        .query({ make: 'toyota' })
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.vehicles).toHaveLength(2);
    });

    it('searches by category and price range together', async () => {
      const response = await request(ctx.app)
        .get('/api/vehicles/search')
        .query({ category: 'SUV', minPrice: 30000, maxPrice: 35000 })
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.body.data.vehicles).toHaveLength(1);
      expect(response.body.data.vehicles[0].model).toBe('RAV4');
    });

    it('supports a free-text query', async () => {
      const response = await request(ctx.app)
        .get('/api/vehicles/search')
        .query({ q: 'F-150' })
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.body.data.vehicles).toHaveLength(1);
    });

    it('can return only vehicles in stock', async () => {
      const response = await request(ctx.app)
        .get('/api/vehicles/search')
        .query({ availableOnly: 'true' })
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.body.data.vehicles).toHaveLength(2);
    });

    it('returns an empty list when nothing matches', async () => {
      const response = await request(ctx.app)
        .get('/api/vehicles/search')
        .query({ make: 'Lamborghini' })
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.vehicles).toEqual([]);
    });

    it('returns 422 for a negative minPrice', async () => {
      const response = await request(ctx.app)
        .get('/api/vehicles/search')
        .query({ minPrice: -5 })
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(422);
    });

    it('returns 422 for a page size above the cap', async () => {
      const response = await request(ctx.app)
        .get('/api/vehicles/search')
        .query({ limit: 5000 })
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(422);
    });

    it('exposes the available makes and categories for filter dropdowns', async () => {
      const response = await request(ctx.app)
        .get('/api/vehicles/filters')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.makes).toEqual(['Ford', 'Toyota']);
      expect(response.body.data.categories).toContain('TRUCK');
    });
  });

  describe('GET /api/vehicles/:id', () => {
    it('returns one vehicle', async () => {
      const id = await seed();

      const response = await request(ctx.app)
        .get(`/api/vehicles/${id}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.vehicle.id).toBe(id);
    });

    it('returns 404 for an unknown id', async () => {
      const response = await request(ctx.app)
        .get('/api/vehicles/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/vehicles/:id', () => {
    it('lets an admin update a vehicle', async () => {
      const id = await seed();

      const response = await request(ctx.app)
        .put(`/api/vehicles/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: 19999 });

      expect(response.status).toBe(200);
      expect(response.body.data.vehicle.price).toBe(19999);
      expect(response.body.data.vehicle.model).toBe('Corolla');
    });

    it('returns 403 for a customer', async () => {
      const id = await seed();

      const response = await request(ctx.app)
        .put(`/api/vehicles/${id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ price: 1 });

      expect(response.status).toBe(403);
    });

    it('returns 404 for an unknown id', async () => {
      const response = await request(ctx.app)
        .put('/api/vehicles/nope')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: 1 });

      expect(response.status).toBe(404);
    });

    it('returns 422 for an empty body', async () => {
      const id = await seed();

      const response = await request(ctx.app)
        .put(`/api/vehicles/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(422);
    });
  });

  describe('DELETE /api/vehicles/:id', () => {
    it('lets an admin delete a vehicle', async () => {
      const id = await seed();

      const response = await request(ctx.app)
        .delete(`/api/vehicles/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(204);

      const after = await request(ctx.app)
        .get(`/api/vehicles/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(after.status).toBe(404);
    });

    it('returns 403 for a customer', async () => {
      const id = await seed();

      const response = await request(ctx.app)
        .delete(`/api/vehicles/${id}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(403);
    });

    it('returns 404 when deleting twice', async () => {
      const id = await seed();

      await request(ctx.app)
        .delete(`/api/vehicles/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      const response = await request(ctx.app)
        .delete(`/api/vehicles/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/vehicles/:id/purchase', () => {
    it('lets a customer buy a vehicle and reports the new stock', async () => {
      const id = await seed();

      const response = await request(ctx.app)
        .post(`/api/vehicles/${id}/purchase`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ quantity: 2 });

      expect(response.status).toBe(201);
      expect(response.body.data.vehicle.quantity).toBe(1);
      expect(response.body.data.purchase.totalPrice).toBe(43000);
    });

    it('defaults to buying one when no quantity is sent', async () => {
      const id = await seed();

      const response = await request(ctx.app)
        .post(`/api/vehicles/${id}/purchase`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({});

      expect(response.status).toBe(201);
      expect(response.body.data.vehicle.quantity).toBe(2);
    });

    it('returns 409 when buying more than is in stock', async () => {
      const id = await seed({ quantity: 1 });

      const response = await request(ctx.app)
        .post(`/api/vehicles/${id}/purchase`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ quantity: 2 });

      expect(response.status).toBe(409);
    });

    it('returns 409 for a sold-out vehicle', async () => {
      const id = await seed({ quantity: 0 });

      const response = await request(ctx.app)
        .post(`/api/vehicles/${id}/purchase`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ quantity: 1 });

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(/out of stock/i);
    });

    it('returns 401 without a token', async () => {
      const id = await seed();
      const response = await request(ctx.app).post(`/api/vehicles/${id}/purchase`).send({});

      expect(response.status).toBe(401);
    });

    it('returns 404 for an unknown vehicle', async () => {
      const response = await request(ctx.app)
        .post('/api/vehicles/nope/purchase')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ quantity: 1 });

      expect(response.status).toBe(404);
    });

    it('returns 422 for a zero quantity', async () => {
      const id = await seed();

      const response = await request(ctx.app)
        .post(`/api/vehicles/${id}/purchase`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ quantity: 0 });

      expect(response.status).toBe(422);
    });

    it('never oversells when the same stock is bought twice', async () => {
      const id = await seed({ quantity: 1 });
      const auth = { Authorization: `Bearer ${customerToken}` };

      const first = await request(ctx.app)
        .post(`/api/vehicles/${id}/purchase`)
        .set(auth)
        .send({ quantity: 1 });
      const second = await request(ctx.app)
        .post(`/api/vehicles/${id}/purchase`)
        .set(auth)
        .send({ quantity: 1 });

      expect(first.status).toBe(201);
      expect(second.status).toBe(409);

      const after = await request(ctx.app).get(`/api/vehicles/${id}`).set(auth);
      expect(after.body.data.vehicle.quantity).toBe(0);
    });
  });

  describe('POST /api/vehicles/:id/restock', () => {
    it('lets an admin add stock', async () => {
      const id = await seed({ quantity: 0 });

      const response = await request(ctx.app)
        .post(`/api/vehicles/${id}/restock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 5 });

      expect(response.status).toBe(200);
      expect(response.body.data.vehicle.quantity).toBe(5);
    });

    it('returns 403 for a customer', async () => {
      const id = await seed();

      const response = await request(ctx.app)
        .post(`/api/vehicles/${id}/restock`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ quantity: 5 });

      expect(response.status).toBe(403);
    });

    it('returns 422 for a zero quantity', async () => {
      const id = await seed();

      const response = await request(ctx.app)
        .post(`/api/vehicles/${id}/restock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 0 });

      expect(response.status).toBe(422);
    });

    it('returns 404 for an unknown vehicle', async () => {
      const response = await request(ctx.app)
        .post('/api/vehicles/nope/restock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 1 });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/purchases/me', () => {
    it("returns the signed-in user's purchases only", async () => {
      const id = await seed();
      const other = await registerCustomer(ctx.app);

      await request(ctx.app)
        .post(`/api/vehicles/${id}/purchase`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ quantity: 1 })
        .expect(201);

      const mine = await request(ctx.app)
        .get('/api/purchases/me')
        .set('Authorization', `Bearer ${customerToken}`);
      const theirs = await request(ctx.app)
        .get('/api/purchases/me')
        .set('Authorization', `Bearer ${other.token}`);

      expect(mine.body.data.purchases).toHaveLength(1);
      expect(mine.body.data.purchases[0].vehicle.model).toBe('Corolla');
      expect(theirs.body.data.purchases).toEqual([]);
    });

    it('returns 401 without a token', async () => {
      expect((await request(ctx.app).get('/api/purchases/me')).status).toBe(401);
    });
  });
});

describe('validation messages', () => {
  let ctx: TestContext;
  let adminToken: string;

  beforeEach(async () => {
    ctx = createTestContext();
    adminToken = (await registerAdmin(ctx.app, ctx.db)).token;
  });

  afterEach(() => ctx.cleanup());

  it('says a required number is missing rather than "received nan"', async () => {
    // Zod's coercion turns an absent value into NaN, which produced the
    // user-facing message "Expected number, received nan". Found by leaving
    // the price blank in the running app.
    const response = await request(ctx.app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ make: 'Polestar', model: 'Polestar 4', category: 'SEDAN', year: 2025 });

    expect(response.status).toBe(422);

    const priceError = response.body.error.details.find(
      (detail: { field: string }) => detail.field === 'price',
    );

    expect(priceError.message).toBe('Price is required');
    expect(JSON.stringify(response.body)).not.toMatch(/nan/i);
  });

  it('still reports a genuinely non-numeric price as such', async () => {
    const response = await request(ctx.app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...newVehicle, price: 'free' });

    expect(response.status).toBe(422);
    expect(
      response.body.error.details.find((d: { field: string }) => d.field === 'price').message,
    ).toBe('Price must be a number');
  });

  it('accepts a deliberate zero quantity', async () => {
    const response = await request(ctx.app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...newVehicle, quantity: 0 });

    expect(response.status).toBe(201);
    expect(response.body.data.vehicle.quantity).toBe(0);
  });
});
