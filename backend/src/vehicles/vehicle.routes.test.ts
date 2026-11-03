import express, { type RequestHandler } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  requireVehicleOwner,
  type AuthenticatedRequest,
} from "./vehicle.auth.js";
import {
  DuplicateLicensePlateError,
  type VehicleRepository,
} from "./vehicle.repository.js";
import type { VehicleRecord } from "./vehicle.types.js";
import { createVehicleRouter } from "./vehicle.routes.js";

const owner = "U001";

function memoryVehicles(): VehicleRepository {
  const records = new Map<string, VehicleRecord>();
  let nextId = 1;

  return {
    async listLicensePlates() {
      return [...records.values()].map((vehicle) => vehicle.licensePlate);
    },
    async create(input) {
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
    (req as AuthenticatedRequest).user = { id: userId };
    requireVehicleOwner(req, res, next);
  };
}

function appFor(vehicles: VehicleRepository, userId?: string) {
  const app = express();
  app.use(express.json());
  app.use(
    "/api/vehicles",
    createVehicleRouter({
      vehicles,
      requireOwner: userId === undefined ? requireVehicleOwner : asUser(userId),
    }),
  );
  return app;
}

const createBody = {
  licensePlate: "1ab-2345",
  brand: " Skoda ",
  model: "Octavia",
  engineType: "combustion",
  size: "standard",
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
    expect(await vehicles.listLicensePlates()).toEqual(["1AB2345"]);
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
    vehicles.listLicensePlates = () => Promise.reject(new Error("db down"));

    const res = await request(appFor(vehicles, owner))
      .post("/api/vehicles")
      .send(createBody);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to save the vehicle");
  });
});
