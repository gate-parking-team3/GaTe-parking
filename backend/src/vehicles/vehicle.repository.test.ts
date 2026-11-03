import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const find = vi.fn();
const findById = vi.fn();
const findByIdAndUpdate = vi.fn();
const findByIdAndDelete = vi.fn();

vi.mock("./vehicle.model.js", () => ({
  VehicleModel: {
    create: (...args: unknown[]) => create(...args),
    find: (...args: unknown[]) => find(...args),
    findById: (...args: unknown[]) => findById(...args),
    findByIdAndUpdate: (...args: unknown[]) => findByIdAndUpdate(...args),
    findByIdAndDelete: (...args: unknown[]) => findByIdAndDelete(...args),
  },
}));

const { DuplicateLicensePlateError, mongoVehicleRepository } =
  await import("./vehicle.repository.js");

const stored = {
  _id: "6908abc12345678901234567",
  licensePlate: "1AB2345",
  brand: "Skoda",
  model: "Octavia",
  engineType: "combustion",
  size: "standard",
  userId: "U001",
};

const input = {
  licensePlate: "1AB2345",
  brand: "Skoda",
  model: "Octavia",
  engineType: "combustion" as const,
  size: "standard" as const,
  userId: "U001",
};

describe("mongoVehicleRepository", () => {
  beforeEach(() => {
    create.mockReset();
    find.mockReset();
    findById.mockReset();
    findByIdAndUpdate.mockReset();
    findByIdAndDelete.mockReset();
  });

  it("maps MongoDB _id to id", async () => {
    create.mockResolvedValue(stored);
    find.mockReturnValue({
      select: () => ({ lean: () => Promise.resolve([stored]) }),
    });
    findById.mockReturnValue({ lean: () => Promise.resolve(stored) });

    const created = await mongoVehicleRepository.create(input);
    const found = await mongoVehicleRepository.findById(stored._id);
    const plates = await mongoVehicleRepository.listLicensePlates();

    expect(created.id).toBe(stored._id);
    expect(created).not.toHaveProperty("_id");
    expect(found).toEqual(created);
    expect(plates).toEqual(["1AB2345"]);
  });

  it("returns null when the document is missing", async () => {
    findById.mockReturnValue({ lean: () => Promise.resolve(null) });
    findByIdAndUpdate.mockReturnValue({ lean: () => Promise.resolve(null) });
    findByIdAndDelete.mockReturnValue({ lean: () => Promise.resolve(null) });

    expect(await mongoVehicleRepository.findById(stored._id)).toBeNull();
    expect(await mongoVehicleRepository.update(stored._id, {})).toBeNull();
    expect(await mongoVehicleRepository.deleteById(stored._id)).toBe(false);
  });

  it("updates and deletes a document", async () => {
    findByIdAndUpdate.mockReturnValue({
      lean: () => Promise.resolve({ ...stored, model: "Superb" }),
    });
    findByIdAndDelete.mockReturnValue({ lean: () => Promise.resolve(stored) });

    const updated = await mongoVehicleRepository.update(stored._id, {
      model: "Superb",
    });

    expect(updated?.model).toBe("Superb");
    expect(await mongoVehicleRepository.deleteById(stored._id)).toBe(true);
  });

  it("turns a duplicate key into DuplicateLicensePlateError", async () => {
    create.mockRejectedValue({ code: 11000 });
    findByIdAndUpdate.mockReturnValue({
      lean: () => Promise.reject({ code: 11000 }),
    });

    await expect(mongoVehicleRepository.create(input)).rejects.toBeInstanceOf(
      DuplicateLicensePlateError,
    );
    await expect(
      mongoVehicleRepository.update(stored._id, { licensePlate: "1AB2345" }),
    ).rejects.toBeInstanceOf(DuplicateLicensePlateError);
  });

  it("rethrows other database errors", async () => {
    create.mockRejectedValue(new Error("db down"));

    await expect(mongoVehicleRepository.create(input)).rejects.toThrow(
      "db down",
    );
  });
});
