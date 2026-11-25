import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { signToken } from "../auth/token.js";
import { memoryAuditLogStore } from "../audit/memory-audit-store.js";
import type { AuditLogStore } from "../audit/audit.types.js";
import type { ParkingSpotRecord } from "../parks/parkingSpot.types.js";
import type { ParkingLotRecord } from "../reservations/reservation.store.js";
import { memoryUserStore } from "../users/memory-user-store.js";
import type { User } from "../users/user.js";
import { memoryAdminSpotStore } from "./memory-spot-store.js";
import type { AdminSpotStore } from "./spot.store.js";

const SECRET = "test-secret";

const eva: User = {
  id: "eva",
  email: "eva@gate.cz",
  name: "Eva",
  passwordHash: "x",
  role: "admin",
  status: "active",
};
const leo: User = {
  id: "leo",
  email: "leo@gate.cz",
  name: "Leo",
  passwordHash: "x",
  role: "admin",
  status: "active",
};
const petr: User = {
  id: "petr",
  email: "petr@gate.cz",
  name: "Petr",
  passwordHash: "x",
  role: "user",
  status: "active",
};

const north = (): ParkingLotRecord => ({
  id: "north",
  name: "North Lot",
  address: "North Street 12",
  totalCapacity: 10,
  evCapacity: 2,
  disabledCapacity: 1,
});

let lots: ParkingLotRecord[];
let spots: AdminSpotStore;
let audit: AuditLogStore;
let users: ReturnType<typeof memoryUserStore>;
let clock: Date;
let app: ReturnType<typeof createApp>;

function token(id: string): string {
  return `Bearer ${signToken(id, SECRET)}`;
}

function spotBody(overrides: Record<string, unknown> = {}) {
  return {
    spotNumber: "A-101",
    lotId: "north",
    type: "standard",
    size: "standard",
    ...overrides,
  };
}

function authGet(id: string, path: string) {
  return request(app).get(path).set("Authorization", token(id));
}

function authPatch(id: string, path: string) {
  return request(app).patch(path).set("Authorization", token(id));
}

async function createSpot(id: string, body: object) {
  return request(app)
    .post("/api/admin/spots")
    .set("Authorization", token(id))
    .send(body);
}

beforeEach(() => {
  lots = [north()];
  spots = memoryAdminSpotStore();
  audit = memoryAuditLogStore();
  users = memoryUserStore([eva, leo, petr]);
  clock = new Date("2026-11-24T08:00:00.000Z");
  app = createApp({
    users,
    jwtSecret: SECRET,
    spots,
    auditLogs: audit,
    lots: {
      async findById(id) {
        return lots.find((lot) => lot.id === id) ?? null;
      },
    },
    now: () => {
      const current = clock;
      clock = new Date(clock.getTime() + 1000);
      return current;
    },
    rateLimits: { login: 1000, api: 10000 },
  });
});

describe("POST /api/admin/spots", () => {
  it("creates a spot and writes an audit log for the signed-in admin", async () => {
    const res = await createSpot(eva.id, {
      ...spotBody({ spotNumber: "  a-101 " }),
      userId: petr.id,
      createdAt: "2020-01-01T00:00:00.000Z",
    });

    expect(res.status).toBe(201);
    expect(res.body.spot).toEqual({
      id: expect.any(String),
      spotNumber: "A-101",
      lotId: "north",
      type: "standard",
      size: "standard",
      status: "free",
    });

    const logs = await authGet(eva.id, "/api/admin/audit-logs");
    expect(logs.status).toBe(200);
    expect(logs.body.logs).toEqual([
      {
        id: expect.any(String),
        user: { id: eva.id, name: "Eva", email: "eva@gate.cz" },
        action: "Created parking spot A-101 in lot North Lot",
        createdAt: "2026-11-24T08:00:00.000Z",
      },
    ]);
  });

  it("keeps a status that was sent and otherwise defaults to free", async () => {
    const reserved = await createSpot(
      eva.id,
      spotBody({ spotNumber: "B-1", status: "reserved" }),
    );
    const free = await createSpot(eva.id, spotBody({ spotNumber: "B-2" }));

    expect(reserved.body.spot.status).toBe("reserved");
    expect(free.body.spot.status).toBe("free");
  });

  it("rejects missing and invalid fields", async () => {
    const cases: Array<[object, string]> = [
      [{}, "spotNumber is required"],
      [spotBody({ spotNumber: "   " }), "spotNumber is required"],
      [spotBody({ spotNumber: 12 }), "spotNumber is required"],
      [
        spotBody({ spotNumber: "A 101" }),
        "spotNumber may contain only letters A-Z, digits 0-9, and hyphens",
      ],
      [
        spotBody({ spotNumber: "A_101" }),
        "spotNumber may contain only letters A-Z, digits 0-9, and hyphens",
      ],
      [{ spotNumber: "A-1" }, "lotId is required"],
      [spotBody({ lotId: "  " }), "lotId is required"],
      [
        spotBody({ type: undefined }),
        "type must be one of: standard, disabled, ev",
      ],
      [
        spotBody({ type: "vip" }),
        "type must be one of: standard, disabled, ev",
      ],
      [
        spotBody({ size: "huge" }),
        "size must be one of: small, standard, large",
      ],
      [
        spotBody({ status: "broken" }),
        "status must be one of: free, reserved, occupied",
      ],
      [
        spotBody({ status: null }),
        "status must be one of: free, reserved, occupied",
      ],
      [["A-101"], "Request body must be an object"],
    ];

    for (const [body, error] of cases) {
      const res = await createSpot(eva.id, body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error });
    }
  });

  it("refuses anonymous callers and employees", async () => {
    const anonymous = await request(app)
      .post("/api/admin/spots")
      .send(spotBody());
    const badToken = await request(app)
      .post("/api/admin/spots")
      .set("Authorization", "Bearer not-a-token")
      .send(spotBody());
    const employee = await createSpot(petr.id, spotBody());

    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual({ error: "Not signed in" });
    expect(badToken.status).toBe(401);
    expect(employee.status).toBe(403);
    expect(employee.body).toEqual({ error: "Not allowed" });
  });

  it("returns 404 when the parking lot does not exist", async () => {
    const res = await createSpot(eva.id, spotBody({ lotId: "missing" }));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Parking lot not found" });
  });

  it("rejects a duplicate number in one lot and allows it in another", async () => {
    lots.push({ ...north(), id: "south", name: "South Lot" });

    const first = await createSpot(eva.id, spotBody({ spotNumber: "a-101" }));
    const duplicate = await createSpot(
      eva.id,
      spotBody({ spotNumber: "A-101" }),
    );
    const otherLot = await createSpot(
      eva.id,
      spotBody({ spotNumber: "A-101", lotId: "south" }),
    );

    expect(first.status).toBe(201);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual({
      error: "Spot number already exists in this parking lot",
    });
    expect(otherLot.status).toBe(201);
    expect(otherLot.body.spot.lotId).toBe("south");
  });

  it("counts reserved and occupied spots toward total capacity", async () => {
    lots = [
      {
        ...north(),
        totalCapacity: 2,
        evCapacity: 0,
        disabledCapacity: 0,
      },
    ];
    await spots.insert(existing("A-1", "occupied"));
    await spots.insert(existing("A-2", "reserved"));

    const res = await createSpot(eva.id, spotBody({ spotNumber: "A-3" }));

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "Parking lot is at total capacity" });
    expect(await spots.list()).toHaveLength(2);
  });

  it("rejects an EV spot above evCapacity while the lot still has room", async () => {
    await spots.insert(existing("E-1", "free", "ev"));
    await spots.insert(existing("E-2", "occupied", "ev"));

    const res = await createSpot(
      eva.id,
      spotBody({ spotNumber: "E-3", type: "ev" }),
    );

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "EV spot capacity exceeded" });
  });

  it("rejects a disabled spot above disabledCapacity", async () => {
    await spots.insert(existing("D-1", "free", "disabled"));

    const res = await createSpot(
      eva.id,
      spotBody({ spotNumber: "D-2", type: "disabled", size: "large" }),
    );

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "Disabled spot capacity exceeded" });
  });

  it("rejects a standard spot above the room left by EV and disabled capacity", async () => {
    for (let number = 1; number <= 7; number += 1) {
      await spots.insert(existing(`S-${number}`, "free"));
    }

    const res = await createSpot(eva.id, spotBody({ spotNumber: "S-8" }));

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "Standard spot capacity exceeded" });
    expect(await spots.list()).toHaveLength(7);
  });

  it("lets concurrent creates fill a lot without going over its capacity", async () => {
    lots = [
      { ...north(), totalCapacity: 2, evCapacity: 0, disabledCapacity: 0 },
    ];

    const responses = await Promise.all(
      [1, 2, 3, 4, 5].map((number) =>
        createSpot(eva.id, spotBody({ spotNumber: `C-${number}` })),
      ),
    );

    const created = responses.filter((res) => res.status === 201);
    const rejected = responses.filter((res) => res.status === 409);
    expect(created).toHaveLength(2);
    expect(rejected).toHaveLength(3);
    expect(
      rejected.every(
        (res) => res.body.error === "Parking lot is at total capacity",
      ),
    ).toBe(true);
    expect(await spots.list()).toHaveLength(2);
    expect(await audit.list({})).toHaveLength(2);
  });

  it("keeps one EV spot when concurrent creates share one EV place", async () => {
    lots = [
      { ...north(), totalCapacity: 10, evCapacity: 1, disabledCapacity: 0 },
    ];

    const responses = await Promise.all(
      [1, 2, 3, 4].map((number) =>
        createSpot(eva.id, spotBody({ spotNumber: `E-${number}`, type: "ev" })),
      ),
    );

    expect(responses.filter((res) => res.status === 201)).toHaveLength(1);
    expect(
      responses
        .filter((res) => res.status === 409)
        .every((res) => res.body.error === "EV spot capacity exceeded"),
    ).toBe(true);
    const listed = await spots.list();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.type).toBe("ev");
  });

  it("removes the spot when the audit log cannot be saved", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    audit.append = () => Promise.reject(new Error("audit failed"));

    const res = await createSpot(eva.id, spotBody());

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Something went wrong" });
    expect(await spots.list()).toEqual([]);
    expect(await audit.list({})).toEqual([]);
    errors.mockRestore();
  });

  it("reports 500 when the spot cannot be removed after a failed audit log", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    audit.append = () => Promise.reject(new Error("audit failed"));
    spots.deleteById = () => Promise.reject(new Error("delete failed"));

    const res = await createSpot(eva.id, spotBody());

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Something went wrong" });
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });

  it("returns 500 and keeps no spot when the insert fails unexpectedly", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    spots.insert = () => Promise.reject(new Error("db down"));

    const res = await createSpot(eva.id, spotBody());

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Something went wrong" });
    expect(await spots.list()).toEqual([]);
    expect(await audit.list({})).toEqual([]);
    errors.mockRestore();
  });
});

describe("GET /api/admin/spots", () => {
  it("lists every spot, or one lot, and an empty list when there are none", async () => {
    expect((await authGet(eva.id, "/api/admin/spots")).body).toEqual({
      spots: [],
    });

    await createSpot(eva.id, spotBody({ spotNumber: "B-2" }));
    await createSpot(eva.id, spotBody({ spotNumber: "A-1", lotId: "north" }));
    lots.push({ ...north(), id: "south", name: "South Lot" });
    await createSpot(eva.id, spotBody({ spotNumber: "A-9", lotId: "south" }));

    const all = await authGet(eva.id, "/api/admin/spots");
    const northOnly = await authGet(eva.id, "/api/admin/spots").query({
      lotId: "north",
    });
    const none = await authGet(eva.id, "/api/admin/spots").query({
      lotId: "missing",
    });

    expect(all.status).toBe(200);
    expect(
      all.body.spots.map((spot: ParkingSpotRecord) => spot.spotNumber),
    ).toEqual(["A-1", "A-9", "B-2"]);
    expect(
      northOnly.body.spots.map((spot: ParkingSpotRecord) => spot.spotNumber),
    ).toEqual(["A-1", "B-2"]);
    expect(none.body).toEqual({ spots: [] });
  });

  it("rejects a blank or repeated lotId and hides the list from employees", async () => {
    const blank = await authGet(eva.id, "/api/admin/spots").query({
      lotId: "  ",
    });
    const repeated = await authGet(eva.id, "/api/admin/spots").query({
      lotId: ["north", "south"],
    });
    const employee = await authGet(petr.id, "/api/admin/spots");

    expect(blank.status).toBe(400);
    expect(blank.body).toEqual({ error: "lotId must be a non-empty string" });
    expect(repeated.status).toBe(400);
    expect(repeated.body).toEqual({ error: "lotId must be a single value" });
    expect(employee.status).toBe(403);
  });
});

describe("GET /api/admin/audit-logs", () => {
  it("lists every user's rows newest first", async () => {
    await createSpot(eva.id, spotBody({ spotNumber: "A-1" }));
    await createSpot(leo.id, spotBody({ spotNumber: "A-2" }));
    await createSpot(eva.id, spotBody({ spotNumber: "A-3" }));

    const res = await authGet(leo.id, "/api/admin/audit-logs");

    expect(res.status).toBe(200);
    expect(res.body.logs.map((log: { action: string }) => log.action)).toEqual([
      "Created parking spot A-3 in lot North Lot",
      "Created parking spot A-2 in lot North Lot",
      "Created parking spot A-1 in lot North Lot",
    ]);
    expect(res.body.logs[1].user).toEqual({
      id: leo.id,
      name: "Leo",
      email: "leo@gate.cz",
    });
  });

  it("combines user, action type and date filters", async () => {
    await createSpot(eva.id, spotBody({ spotNumber: "A-1" }));
    await createSpot(leo.id, spotBody({ spotNumber: "A-2" }));
    await createSpot(eva.id, spotBody({ spotNumber: "A-3" }));

    const byUser = await authGet(eva.id, "/api/admin/audit-logs").query({
      userId: eva.id,
      actionType: "spot.created",
    });
    const window = await authGet(eva.id, "/api/admin/audit-logs").query({
      userId: eva.id,
      dateFrom: "2026-11-24T08:00:02.000Z",
      dateTo: "2026-11-24T08:00:02.000Z",
    });
    const day = await authGet(eva.id, "/api/admin/audit-logs").query({
      dateFrom: "2026-11-24",
      dateTo: "2026-11-24",
    });

    expect(byUser.body.logs).toHaveLength(2);
    expect(
      byUser.body.logs.every(
        (log: { user: { id: string } }) => log.user.id === eva.id,
      ),
    ).toBe(true);
    expect(window.body.logs).toEqual([
      expect.objectContaining({
        action: "Created parking spot A-3 in lot North Lot",
      }),
    ]);
    expect(day.body.logs).toHaveLength(3);
  });

  it("pages only when both page and pageSize are sent", async () => {
    await createSpot(eva.id, spotBody({ spotNumber: "A-1" }));
    await createSpot(eva.id, spotBody({ spotNumber: "A-2" }));
    await createSpot(eva.id, spotBody({ spotNumber: "A-3" }));

    const page = await authGet(eva.id, "/api/admin/audit-logs").query({
      page: "2",
      pageSize: "1",
    });
    const all = await authGet(eva.id, "/api/admin/audit-logs");

    expect(page.body.logs).toHaveLength(1);
    expect(page.body.logs[0].action).toBe(
      "Created parking spot A-2 in lot North Lot",
    );
    expect(all.body.logs).toHaveLength(3);
  });

  it("rejects invalid filters and pagination", async () => {
    const cases: Array<[Record<string, string>, string]> = [
      [{ userId: "  " }, "userId must be a non-empty string"],
      [
        { actionType: "user.deleted" },
        "actionType must be one of: spot.created",
      ],
      [{ dateFrom: "24-11-2026" }, "dateFrom must be an ISO date"],
      [{ dateTo: "2026-02-31" }, "dateTo must be an ISO date"],
      [
        { dateFrom: "2026-11-25", dateTo: "2026-11-24" },
        "dateFrom must be before or equal to dateTo",
      ],
      [{ page: "1" }, "page and pageSize must be provided together"],
      [{ pageSize: "10" }, "page and pageSize must be provided together"],
      [
        { page: "0", pageSize: "10" },
        "page must be a whole number greater than or equal to 1",
      ],
      [
        { page: "1.5", pageSize: "10" },
        "page must be a whole number greater than or equal to 1",
      ],
      [
        { page: "1", pageSize: "0" },
        "pageSize must be a whole number greater than or equal to 1",
      ],
    ];

    for (const [query, error] of cases) {
      const res = await authGet(eva.id, "/api/admin/audit-logs").query(query);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error });
    }
  });

  it("returns an empty list and keeps rows when an admin is only disabled", async () => {
    const empty = await authGet(eva.id, "/api/admin/audit-logs");
    expect(empty.body).toEqual({ logs: [] });

    await createSpot(eva.id, spotBody());
    const disabled = await authPatch(leo.id, "/api/admin/employees/eva").send({
      status: "disabled",
    });
    const logs = await authGet(leo.id, "/api/admin/audit-logs");

    expect(disabled.status).toBe(200);
    expect(logs.body.logs).toHaveLength(1);
    expect(logs.body.logs[0].user).toEqual({
      id: eva.id,
      name: "Eva",
      email: "eva@gate.cz",
    });
  });

  it("leaves the name blank when the user id is no longer in the store", async () => {
    await audit.append({
      userId: "gone",
      action: "Created parking spot Z-1 in lot North Lot",
      actionType: "spot.created",
      createdAt: new Date("2026-11-24T09:00:00.000Z"),
    });

    const res = await authGet(eva.id, "/api/admin/audit-logs");

    expect(res.body.logs[0].user).toEqual({ id: "gone", name: "", email: "" });
  });

  it("refuses anonymous callers and employees", async () => {
    expect((await request(app).get("/api/admin/audit-logs")).status).toBe(401);
    expect((await authGet(petr.id, "/api/admin/audit-logs")).status).toBe(403);
  });
});

function existing(
  spotNumber: string,
  status: ParkingSpotRecord["status"],
  type: ParkingSpotRecord["type"] = "standard",
): ParkingSpotRecord {
  return {
    id: spotNumber,
    spotNumber,
    lotId: "north",
    type,
    size: "standard",
    status,
  };
}
