import express, { type RequestHandler } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { requireVehicleOwner } from "./vehicle.auth.js";
import {
  DuplicateLicensePlateError,
  type VehicleRepository,
} from "./vehicle.repository.js";
import type { VehicleRecord } from "./vehicle.types.js";
import { createVehicleRouter } from "./vehicle.routes.js";
import type { VehicleUsage } from "./vehicle.usage.js";

const owner = "U001";

function memoryVehicles(): VehicleRepository {
  const records = new Map<string, VehicleRecord>();
  let nextId = 1;
  // Stands in for the unique index on the licensePlate field.
  const isTaken = (plate: string, exceptId?: string) =>
    [...records.values()].some(
      (vehicle) => vehicle.id !== exceptId && vehicle.licensePlate === plate,
    );

  return {
    async listByOwner(userId) {
      return [...records.values()].filter(
        (vehicle) => vehicle.userId === userId,
      );
    },
    async create(input) {
      if (isTaken(input.licensePlate)) throw new DuplicateLicensePlateError();
      const id = nextId.toString(16).padStart(24, "0");
      nextId += 1;
      const record = { id, ...input };
      records.set(id, record);
      return record;
    },
    async findById(id) {
      return records.get(id) ?? null;
    },
    async update(id, patch) {
      const current = records.get(id);
      if (!current) return null;
      if (patch.licensePlate && isTaken(patch.licensePlate, id)) {
        throw new DuplicateLicensePlateError();
      }
      const updated = { ...current, ...patch };
      records.set(id, updated);
      return updated;
    },
    async deleteById(id) {
      return records.delete(id);
    },
  };
}

function asUser(userId: string): RequestHandler {
  return (req, res, next) => {
    Object.assign(req, { user: { id: userId } });
    requireVehicleOwner(req, res, next);
  };
}

// Stands in for reservations, parking sessions and owners.
// inUse: vehicle ids with an upcoming or active reservation. inactiveOwners: user ids that are not active.
function fakeUsage(
  vehicles: VehicleRepository,
  { inUse = new Set<string>(), inactiveOwners = new Set<string>() } = {},
): VehicleUsage {
  return {
    async isInUse(vehicleId) {
      return inUse.has(vehicleId);
    },
    async releasePlate(plate) {
      for (const userId of inactiveOwners) {
        const stale = (await vehicles.listByOwner(userId)).find(
          (v) => v.licensePlate === plate && !inUse.has(v.id),
        );
        if (stale) return vehicles.deleteById(stale.id);
      }
      return false;
    },
  };
}

function appFor(
  vehicles: VehicleRepository,
  userId?: string,
  usage: VehicleUsage = fakeUsage(vehicles),
) {
  const app = express();
  app.use(express.json());
  app.use(
    "/api/vehicles",
    createVehicleRouter({
      vehicles,
      requireOwner: userId === undefined ? requireVehicleOwner : asUser(userId),
      usage,
    }),
  );
  return app;
}

const createBody = {
  licensePlate: "1ab-2345",
  brand: " Skoda ",
  model: "Octavia",
  engineType: "combustion" as const,
  size: "standard" as const,
  userId: "NOT-THE-OWNER",
};

describe("vehicle routes", () => {
  it("creates a vehicle for the authenticated user", async () => {
    const vehicles = memoryVehicles();
    const res = await request(appFor(vehicles, owner))
      .post("/api/vehicles")
      .send(createBody);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      licensePlate: "1AB2345",
      brand: "Skoda",
      model: "Octavia",
      engineType: "combustion",
      size: "standard",
      userId: owner,
    });
    expect(res.body.id).toMatch(/^[0-9a-f]{24}$/);
    expect(
      (await vehicles.listByOwner(owner)).map((v) => v.licensePlate),
    ).toEqual(["1AB2345"]);
  });

  it("rejects an invalid license plate", async () => {
    const res = await request(appFor(memoryVehicles(), owner))
      .post("/api/vehicles")
      .send({ ...createBody, licensePlate: "A" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(
      "License plate must contain at least 2 characters",
    );
  });

  it("rejects a duplicate normalized license plate", async () => {
    const vehicles = memoryVehicles();
    const app = appFor(vehicles, owner);
    await request(app).post("/api/vehicles").send(createBody);

    const res = await request(app)
      .post("/api/vehicles")
      .send({ ...createBody, licensePlate: "1AB 2345" });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("License plate is already registered");
  });

  it("returns 409 when the repository reports a duplicate plate", async () => {
    const vehicles = memoryVehicles();
    vehicles.create = () => Promise.reject(new DuplicateLicensePlateError());

    const res = await request(appFor(vehicles, owner))
      .post("/api/vehicles")
      .send(createBody);

    expect(res.status).toBe(409);
  });

  it("updates the owner's vehicle", async () => {
    const vehicles = memoryVehicles();
    const created = await request(appFor(vehicles, owner))
      .post("/api/vehicles")
      .send(createBody);

    const res = await request(appFor(vehicles, owner))
      .patch(`/api/vehicles/${created.body.id}`)
      .send({ model: "Superb", engineType: "electric" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: created.body.id,
      model: "Superb",
      engineType: "electric",
      userId: owner,
      licensePlate: "1AB2345",
    });
  });

  it("removes the owner's vehicle", async () => {
    const vehicles = memoryVehicles();
    const created = await request(appFor(vehicles, owner))
      .post("/api/vehicles")
      .send(createBody);

    const res = await request(appFor(vehicles, owner)).delete(
      `/api/vehicles/${created.body.id}`,
    );

    expect(res.status).toBe(204);
    expect(await vehicles.findById(created.body.id)).toBeNull();
  });

  it("refuses to remove a vehicle with an upcoming or active reservation", async () => {
    const vehicles = memoryVehicles();
    const created = await vehicles.create({ ...createBody, userId: owner });
    const usage = fakeUsage(vehicles, { inUse: new Set([created.id]) });

    const res = await request(appFor(vehicles, owner, usage)).delete(
      `/api/vehicles/${created.id}`,
    );

    expect(res.status).toBe(409);
    expect(await vehicles.findById(created.id)).not.toBeNull();
  });

  it("frees the plate of an inactive user's vehicle for a new registration", async () => {
    const vehicles = memoryVehicles();
    const stale = await vehicles.create({
      ...createBody,
      licensePlate: "1AB2345",
      userId: "U-DISABLED",
    });
    const usage = fakeUsage(vehicles, {
      inactiveOwners: new Set(["U-DISABLED"]),
    });

    const res = await request(appFor(vehicles, owner, usage))
      .post("/api/vehicles")
      .send(createBody);

    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(owner);
    expect(await vehicles.findById(stale.id)).toBeNull();
  });

  it("keeps the plate of an inactive user's vehicle that is still in use", async () => {
    const vehicles = memoryVehicles();
    const stale = await vehicles.create({
      ...createBody,
      licensePlate: "1AB2345",
      userId: "U-DISABLED",
    });
    const usage = fakeUsage(vehicles, {
      inUse: new Set([stale.id]),
      inactiveOwners: new Set(["U-DISABLED"]),
    });

    const res = await request(appFor(vehicles, owner, usage))
      .post("/api/vehicles")
      .send(createBody);

    expect(res.status).toBe(409);
  });

  it("marks electric cars with EV charging privileges", async () => {
    const vehicles = memoryVehicles();
    const app = appFor(vehicles, owner);
    const combustion = await request(app)
      .post("/api/vehicles")
      .send(createBody);
    const electric = await request(app)
      .post("/api/vehicles")
      .send({ ...createBody, licensePlate: "2EV1234", engineType: "electric" });

    expect(combustion.body.evCharging).toBe(false);
    expect(electric.body.evCharging).toBe(true);
    const listed = await request(app).get("/api/vehicles");
    expect(
      listed.body.map((v: { evCharging: boolean }) => v.evCharging),
    ).toEqual([false, true]);
  });

  it("refuses an update of another user's vehicle", async () => {
    const vehicles = memoryVehicles();
    const created = await request(appFor(vehicles, owner))
      .post("/api/vehicles")
      .send(createBody);

    const res = await request(appFor(vehicles, "U002"))
      .patch(`/api/vehicles/${created.body.id}`)
      .send({ model: "Fabia" });

    expect(res.status).toBe(403);
    expect((await vehicles.findById(created.body.id))?.model).toBe("Octavia");
  });

  it("refuses removal of another user's vehicle", async () => {
    const vehicles = memoryVehicles();
    const created = await request(appFor(vehicles, owner))
      .post("/api/vehicles")
      .send(createBody);

    const res = await request(appFor(vehicles, "U002")).delete(
      `/api/vehicles/${created.body.id}`,
    );

    expect(res.status).toBe(403);
    expect(await vehicles.findById(created.body.id)).not.toBeNull();
  });

  it("requires authentication", async () => {
    const vehicles = memoryVehicles();
    const app = appFor(vehicles);
    const created = await request(appFor(vehicles, owner))
      .post("/api/vehicles")
      .send(createBody);

    const post = await request(app).post("/api/vehicles").send(createBody);
    const patch = await request(app)
      .patch(`/api/vehicles/${created.body.id}`)
      .send({ model: "Fabia" });
    const del = await request(app).delete(`/api/vehicles/${created.body.id}`);

    expect(post.status).toBe(401);
    expect(patch.status).toBe(401);
    expect(del.status).toBe(401);
  });

  it("rejects an invalid vehicle id", async () => {
    const app = appFor(memoryVehicles(), owner);

    const patch = await request(app).patch("/api/vehicles/not-an-id").send({
      model: "Fabia",
    });
    const del = await request(app).delete("/api/vehicles/not-an-id");

    expect(patch.status).toBe(400);
    expect(patch.body.error).toBe("Invalid vehicle id");
    expect(del.status).toBe(400);
  });

  it("returns 404 when the vehicle does not exist", async () => {
    const app = appFor(memoryVehicles(), owner);
    const id = "6908abc12345678901234567";

    const patch = await request(app)
      .patch(`/api/vehicles/${id}`)
      .send({ model: "Fabia" });
    const del = await request(app).delete(`/api/vehicles/${id}`);

    expect(patch.status).toBe(404);
    expect(del.status).toBe(404);
  });

  it("rejects a plate change that collides with another vehicle", async () => {
    const vehicles = memoryVehicles();
    const app = appFor(vehicles, owner);
    await request(app)
      .post("/api/vehicles")
      .send({ ...createBody, licensePlate: "2CD3456" });
    const created = await request(app).post("/api/vehicles").send(createBody);

    const res = await request(app)
      .patch(`/api/vehicles/${created.body.id}`)
      .send({ licensePlate: "2cd-3456" });

    expect(res.status).toBe(409);
  });

  it("rejects userId and id changes", async () => {
    const vehicles = memoryVehicles();
    const created = await request(appFor(vehicles, owner))
      .post("/api/vehicles")
      .send(createBody);

    const res = await request(appFor(vehicles, owner))
      .patch(`/api/vehicles/${created.body.id}`)
      .send({ userId: "U002", model: "Fabia" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("userId cannot be changed");
    expect((await vehicles.findById(created.body.id))?.userId).toBe(owner);
  });

  it("returns 500 when storage fails", async () => {
    const vehicles = memoryVehicles();
    vehicles.create = () => Promise.reject(new Error("db down"));

    const res = await request(appFor(vehicles, owner))
      .post("/api/vehicles")
      .send(createBody);

    // The app's jsonErrors handler shapes and logs this; here Express' default handler answers.
    expect(res.status).toBe(500);
  });

  it("lists only the signed-in user's vehicles", async () => {
    const vehicles = memoryVehicles();
    await vehicles.create({
      ...createBody,
      licensePlate: "1AB2345",
      userId: owner,
    });
    await vehicles.create({
      ...createBody,
      licensePlate: "2CD3456",
      userId: "U002",
    });

    const res = await request(appFor(vehicles, owner)).get("/api/vehicles");

    expect(res.status).toBe(200);
    expect(res.body.map((v: VehicleRecord) => v.licensePlate)).toEqual([
      "1AB2345",
    ]);
  });

  it("returns one vehicle to its owner only", async () => {
    const vehicles = memoryVehicles();
    const mine = await vehicles.create({
      ...createBody,
      licensePlate: "1AB2345",
      userId: owner,
    });
    const theirs = await vehicles.create({
      ...createBody,
      licensePlate: "2CD3456",
      userId: "U002",
    });
    const app = appFor(vehicles, owner);

    expect((await request(app).get(`/api/vehicles/${mine.id}`)).status).toBe(
      200,
    );
    expect((await request(app).get(`/api/vehicles/${theirs.id}`)).status).toBe(
      403,
    );
    expect((await request(app).get("/api/vehicles/nope")).status).toBe(400);
    expect(
      (await request(app).get(`/api/vehicles/${"f".repeat(24)}`)).status,
    ).toBe(404);
  });

  it("replaces a vehicle with PUT and requires every field", async () => {
    const vehicles = memoryVehicles();
    const mine = await vehicles.create({
      ...createBody,
      licensePlate: "1AB2345",
      userId: owner,
    });
    const app = appFor(vehicles, owner);

    const ok = await request(app)
      .put(`/api/vehicles/${mine.id}`)
      .send({ ...createBody, model: "Enyaq", engineType: "electric" });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({
      model: "Enyaq",
      engineType: "electric",
      userId: owner,
    });

    const partial = await request(app)
      .put(`/api/vehicles/${mine.id}`)
      .send({ model: "Fabia" });
    expect(partial.status).toBe(400);
  });
});
