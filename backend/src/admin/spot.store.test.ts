import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const find = vi.fn();
const deleteOne = vi.fn();
const findLotById = vi.fn();

vi.mock("../parks/parkingSpot.model.js", () => ({
  ParkingSpotModel: {
    create: (...args: unknown[]) => create(...args),
    find: (...args: unknown[]) => find(...args),
    deleteOne: (...args: unknown[]) => deleteOne(...args),
  },
}));

vi.mock("../parks/parkingLot.model.js", () => ({
  ParkingLotModel: {
    findById: (...args: unknown[]) => findLotById(...args),
  },
}));

const { DuplicateSpotNumberError } = await import("./spot.errors.js");
const { mongoAdminSpotStore, mongoParkingLotLookup } =
  await import("./spot.store.js");

const stored = {
  _id: "6908abc12345678901234567",
  spotNumber: "A-101",
  lotId: "6908abc12345678901234568",
  type: "standard",
  size: "large",
  status: "free",
};

const lot = {
  _id: stored.lotId,
  name: "North Lot",
  address: "North Street 12",
  totalCapacity: 10,
  evCapacity: 2,
  disabledCapacity: 1,
};

function spotQuery(docs: unknown[]) {
  return {
    sort: () => ({ lean: () => Promise.resolve(docs) }),
    select: () => ({ lean: () => Promise.resolve(docs) }),
  };
}

describe("mongoAdminSpotStore", () => {
  beforeEach(() => {
    create.mockReset();
    find.mockReset();
    deleteOne.mockReset();
    findLotById.mockReset();
  });

  it("maps MongoDB _id to id and lists a lot", async () => {
    create.mockResolvedValue(stored);
    find.mockReturnValue(spotQuery([stored]));

    const created = await mongoAdminSpotStore.insert({
      spotNumber: "A-101",
      lotId: stored.lotId,
      type: "standard",
      size: "large",
      status: "free",
    });
    const listed = await mongoAdminSpotStore.list(stored.lotId);

    expect(created).toEqual({
      id: stored._id,
      spotNumber: "A-101",
      lotId: stored.lotId,
      type: "standard",
      size: "large",
      status: "free",
    });
    expect(listed).toEqual([created]);
    expect(find).toHaveBeenCalledWith({ lotId: stored.lotId });
  });

  it("counts spots of every status by type", async () => {
    find.mockReturnValue(
      spotQuery([{ type: "ev" }, { type: "ev" }, { type: "disabled" }]),
    );

    await expect(mongoAdminSpotStore.count(stored.lotId)).resolves.toEqual({
      total: 3,
      standard: 0,
      ev: 2,
      disabled: 1,
    });
  });

  it("turns a duplicate key into DuplicateSpotNumberError", async () => {
    create.mockRejectedValue({ code: 11000 });

    await expect(
      mongoAdminSpotStore.insert({
        spotNumber: "A-101",
        lotId: stored.lotId,
        type: "standard",
        size: "large",
        status: "free",
      }),
    ).rejects.toBeInstanceOf(DuplicateSpotNumberError);
  });

  it("rethrows other database errors", async () => {
    create.mockRejectedValue(new Error("db down"));

    await expect(
      mongoAdminSpotStore.insert({
        spotNumber: "A-101",
        lotId: stored.lotId,
        type: "standard",
        size: "large",
        status: "free",
      }),
    ).rejects.toThrow("db down");
  });

  it("deletes a spot by id and ignores an invalid id", async () => {
    deleteOne.mockResolvedValue({ deletedCount: 1 });

    await mongoAdminSpotStore.deleteById(stored._id);
    await mongoAdminSpotStore.deleteById("not-an-id");

    expect(deleteOne).toHaveBeenCalledTimes(1);
    expect(deleteOne).toHaveBeenCalledWith({ _id: stored._id });
  });
});

describe("mongoParkingLotLookup", () => {
  beforeEach(() => {
    findLotById.mockReset();
  });

  it("returns null for an invalid id without querying", async () => {
    await expect(mongoParkingLotLookup.findById("missing")).resolves.toBeNull();
    expect(findLotById).not.toHaveBeenCalled();
  });

  it("maps a lot document", async () => {
    findLotById.mockReturnValue({ lean: () => Promise.resolve(lot) });

    await expect(mongoParkingLotLookup.findById(stored.lotId)).resolves.toEqual(
      {
        id: stored.lotId,
        name: "North Lot",
        address: "North Street 12",
        totalCapacity: 10,
        evCapacity: 2,
        disabledCapacity: 1,
      },
    );
  });

  it("returns null when the lot is missing", async () => {
    findLotById.mockReturnValue({ lean: () => Promise.resolve(null) });

    await expect(
      mongoParkingLotLookup.findById(stored.lotId),
    ).resolves.toBeNull();
  });
});
