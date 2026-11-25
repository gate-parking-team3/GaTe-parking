import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const find = vi.fn();

vi.mock("./audit.model.js", () => ({
  AuditLogModel: {
    create: (...args: unknown[]) => create(...args),
    find: (...args: unknown[]) => find(...args),
  },
}));

const { mongoAuditLogStore } = await import("./audit.store.js");

const stored = {
  _id: "6908abc12345678901234569",
  userId: "6908abc12345678901234561",
  action: "Created parking spot A-101 in lot North Lot",
  actionType: "spot.created",
  createdAt: new Date("2026-11-24T08:00:00.000Z"),
};

function queryOf(docs: unknown[]) {
  const query = {
    sort: () => query,
    skip: () => query,
    limit: () => query,
    lean: () => Promise.resolve(docs),
  };
  return query;
}

describe("mongoAuditLogStore", () => {
  beforeEach(() => {
    create.mockReset();
    find.mockReset();
  });

  it("maps MongoDB _id to id and does not store a name or email", async () => {
    create.mockResolvedValue(stored);

    const saved = await mongoAuditLogStore.append({
      userId: stored.userId,
      action: stored.action,
      actionType: "spot.created",
      createdAt: stored.createdAt,
    });

    expect(saved).toEqual({
      id: stored._id,
      userId: stored.userId,
      action: stored.action,
      actionType: "spot.created",
      createdAt: stored.createdAt,
    });
    expect(create).toHaveBeenCalledWith({
      userId: stored.userId,
      action: stored.action,
      actionType: "spot.created",
      createdAt: stored.createdAt,
    });
  });

  it("filters, sorts newest first and pages when asked", async () => {
    const query = queryOf([stored]);
    const sort = vi.spyOn(query, "sort");
    const skip = vi.spyOn(query, "skip");
    const limit = vi.spyOn(query, "limit");
    find.mockReturnValue(query);
    const from = new Date("2026-11-24T00:00:00.000Z");
    const to = new Date("2026-11-24T23:59:59.999Z");

    const logs = await mongoAuditLogStore.list({
      userId: stored.userId,
      actionType: "spot.created",
      dateFrom: from,
      dateTo: to,
      page: 2,
      pageSize: 10,
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]?.id).toBe(stored._id);
    expect(find).toHaveBeenCalledWith({
      userId: stored.userId,
      actionType: "spot.created",
      createdAt: { $gte: from, $lte: to },
    });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    expect(skip).toHaveBeenCalledWith(10);
    expect(limit).toHaveBeenCalledWith(10);
  });

  it("returns every matching row when page is omitted", async () => {
    const query = queryOf([]);
    const skip = vi.spyOn(query, "skip");
    find.mockReturnValue(query);

    await expect(mongoAuditLogStore.list({})).resolves.toEqual([]);
    expect(skip).not.toHaveBeenCalled();
  });
});
