import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import {
  mongoVehicleRepository,
  type VehicleRepository,
} from "../vehicles/vehicle.repository.js";
import { parseTimeWindow, spotSuitsVehicle } from "./reservation.rules.js";
import {
  mongoReservationStore,
  type ParkingOutcome,
  type ReservationStore,
} from "./reservation.store.js";
import type { ReservationRecord } from "../parks/reservation.types.js";

const ID_PATTERN = /^[a-fA-F0-9]{24}$/;

type Deps = {
  store: ReservationStore;
  vehicles: VehicleRepository;
  now: () => Date;
};

const defaults: Deps = {
  store: mongoReservationStore,
  vehicles: mongoVehicleRepository,
  now: () => new Date(),
};

// Users have no "disabled parking" entitlement yet, so nobody is offered disabled spots.
// Change this in one place once the user model gets that flag.
const DISABLED_ALLOWED = false;

/** Mounted at /api/lots. Needs requireAuth in front. */
export function createLotRouter(deps: Partial<Deps> = {}): Router {
  const { store, vehicles, now } = { ...defaults, ...deps };
  const router = Router();

  router.get(
    "/",
    handle(async (_req, res) => {
      res.json(await store.listLots());
    }),
  );

  // US 4: spots in the lot that suit the vehicle and are free for the whole window.
  router.get(
    "/:lotId/available-spots",
    handle(async (req, res) => {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: "Not signed in" });
        return;
      }
      const lotId = readId(req.params.lotId);
      const vehicleId = readId(req.query.vehicleId);
      if (!lotId || !vehicleId) {
        res.status(400).json({ error: "Invalid lot or vehicle id" });
        return;
      }
      const window = parseTimeWindow(req.query.start, req.query.end, now());
      if (!window.ok) {
        res.status(400).json({ error: window.error });
        return;
      }

      const [lot, vehicle] = await Promise.all([
        store.findLot(lotId),
        vehicles.findById(vehicleId),
      ]);
      if (!lot) {
        res.status(404).json({ error: "Parking lot not found" });
        return;
      }
      if (!vehicle || vehicle.userId !== userId) {
        res.status(404).json({ error: "Vehicle not found" });
        return;
      }

      const evOnly = req.query.evOnly === "true";
      const [spots, busy] = await Promise.all([
        store.listSpots(lotId),
        store.findBusySpotIds(lotId, window.value, now()),
      ]);
      res.json({
        lotId,
        start: window.value.start,
        end: window.value.end,
        spots: spots.filter(
          (spot) =>
            !busy.has(spot.id) &&
            spotSuitsVehicle(spot, vehicle, {
              disabledAllowed: DISABLED_ALLOWED,
              evOnly,
            }),
        ),
      });
    }),
  );

  return router;
}

/** Mounted at /api/reservations. Needs requireAuth in front. */
export function createReservationRouter(deps: Partial<Deps> = {}): Router {
  const { store, vehicles, now } = { ...defaults, ...deps };
  const router = Router();

  // US 4: book a spot for a vehicle and a time window.
  router.post(
    "/",
    handle(async (req, res) => {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: "Not signed in" });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const vehicleId = readId(body.vehicleId);
      const spotId = readId(body.spotId);
      if (!vehicleId || !spotId) {
        res.status(400).json({ error: "Invalid vehicle or spot id" });
        return;
      }
      const window = parseTimeWindow(body.startTime, body.endTime, now());
      if (!window.ok) {
        res.status(400).json({ error: window.error });
        return;
      }

      const [vehicle, spot] = await Promise.all([
        vehicles.findById(vehicleId),
        store.findSpot(spotId),
      ]);
      if (!vehicle || vehicle.userId !== userId) {
        res.status(404).json({ error: "Vehicle not found" });
        return;
      }
      if (!spot) {
        res.status(404).json({ error: "Parking spot not found" });
        return;
      }
      if (
        !spotSuitsVehicle(spot, vehicle, { disabledAllowed: DISABLED_ALLOWED })
      ) {
        res
          .status(422)
          .json({ error: "This spot is not suitable for the vehicle" });
        return;
      }

      const created = await store.createIfFree(
        {
          userId,
          vehicleId,
          spotId,
          lotId: spot.lotId,
          startTime: window.value.start,
          endTime: window.value.end,
        },
        now(),
      );
      if (!created) {
        res.status(409).json({
          error: "The spot or the vehicle is already booked for this time",
        });
        return;
      }
      res.status(201).json(created);
    }),
  );

  // The caller's reservations, newest start first (all statuses).
  router.get(
    "/mine",
    handle(async (req, res) => {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: "Not signed in" });
        return;
      }
      res.json(await store.listByUser(userId));
    }),
  );

  // One reservation: its owner or an admin.
  router.get(
    "/:id",
    handle(async (req, res) => {
      const reservation = await loadReservation(req, res, store, {
        adminAllowed: true,
        forbidden: "You can only view your own reservation",
      });
      if (reservation) res.json(reservation);
    }),
  );

  // US 11: edit an upcoming reservation (window, vehicle, spot). Its owner or an admin.
  router.patch(
    "/:id",
    handle(async (req, res) => {
      const reservation = await loadReservation(req, res, store, {
        adminAllowed: true,
        forbidden: "You can only edit your own reservation",
      });
      if (!reservation) return;
      const at = now();
      if (reservation.status !== "reserved" || reservation.startTime <= at) {
        res
          .status(409)
          .json({ error: "Only an upcoming reservation can be edited" });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      if (EDITABLE_FIELDS.every((field) => body[field] === undefined)) {
        res.status(400).json({
          error: "Send at least one of startTime, endTime, vehicleId, spotId",
        });
        return;
      }
      // Missing fields keep their current value, then the merged result is checked like a new booking.
      const merged = (
        field: (typeof EDITABLE_FIELDS)[number],
        current: string,
      ) => (body[field] === undefined ? current : body[field]);
      const vehicleId = readId(merged("vehicleId", reservation.vehicleId));
      const spotId = readId(merged("spotId", reservation.spotId));
      if (!vehicleId || !spotId) {
        res.status(400).json({ error: "Invalid vehicle or spot id" });
        return;
      }
      const window = parseTimeWindow(
        merged("startTime", reservation.startTime.toISOString()),
        merged("endTime", reservation.endTime.toISOString()),
        at,
      );
      if (!window.ok) {
        res.status(400).json({ error: window.error });
        return;
      }

      const [vehicle, spot] = await Promise.all([
        vehicles.findById(vehicleId),
        store.findSpot(spotId),
      ]);
      // The vehicle must be the reservation owner's, also when an admin edits it.
      if (!vehicle || vehicle.userId !== reservation.userId) {
        res.status(404).json({ error: "Vehicle not found" });
        return;
      }
      if (!spot) {
        res.status(404).json({ error: "Parking spot not found" });
        return;
      }
      if (
        !spotSuitsVehicle(spot, vehicle, { disabledAllowed: DISABLED_ALLOWED })
      ) {
        res
          .status(422)
          .json({ error: "This spot is not suitable for the vehicle" });
        return;
      }

      const outcome = await store.updateIfFree(
        reservation.id,
        {
          vehicleId,
          spotId,
          lotId: spot.lotId,
          startTime: window.value.start,
          endTime: window.value.end,
        },
        at,
      );
      if (outcome.ok) {
        res.json(outcome.value);
        return;
      }
      res.status(409).json({
        error:
          outcome.conflict === "taken"
            ? "The spot or the vehicle is already booked for this time"
            : "The reservation changed in the meantime, reload it and try again",
      });
    }),
  );

  // US 3: check in. Only the owner, only a `reserved` reservation, only inside its window.
  router.post(
    "/:id/start",
    handle(async (req, res) => {
      const reservation = await loadReservation(req, res, store, OWNER_ONLY);
      if (!reservation) return;
      if (reservation.status !== "reserved") {
        res
          .status(409)
          .json({ error: "Only a reserved reservation can be started" });
        return;
      }
      const at = now();
      if (at < reservation.startTime || at >= reservation.endTime) {
        res.status(422).json({
          error: "Parking can only start within the reservation window",
        });
        return;
      }
      sendOutcome(res, await store.startParking(reservation.id, at));
    }),
  );

  // US 3: check out. Only the owner, only an `active` reservation (also after its end time).
  router.post(
    "/:id/end",
    handle(async (req, res) => {
      const reservation = await loadReservation(req, res, store, OWNER_ONLY);
      if (!reservation) return;
      if (reservation.status !== "active") {
        res
          .status(409)
          .json({ error: "Only an active reservation can be ended" });
        return;
      }
      sendOutcome(res, await store.endParking(reservation.id, now()));
    }),
  );

  return router;
}

// US 11: what PATCH /api/reservations/:id may change.
const EDITABLE_FIELDS = [
  "startTime",
  "endTime",
  "vehicleId",
  "spotId",
] as const;

type Access = { adminAllowed: boolean; forbidden: string };

const OWNER_ONLY: Access = {
  adminAllowed: false,
  forbidden: "Only the owner can start or end parking",
};

// Loads the reservation in :id for its owner (or an admin when allowed),
// or sends the error response and returns null.
async function loadReservation(
  req: Request,
  res: Response,
  store: ReservationStore,
  access: Access,
): Promise<ReservationRecord | null> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return null;
  }
  const id = readId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid reservation id" });
    return null;
  }
  const reservation = await store.findById(id);
  if (!reservation) {
    res.status(404).json({ error: "Reservation not found" });
    return null;
  }
  const isAdmin = access.adminAllowed && user.role === "admin";
  if (reservation.userId !== user.id && !isAdmin) {
    res.status(403).json({ error: access.forbidden });
    return null;
  }
  return reservation;
}

function sendOutcome(res: Response, outcome: ParkingOutcome): void {
  if (outcome.ok) {
    res.json(outcome.value);
    return;
  }
  res.status(409).json({
    error:
      outcome.conflict === "already-parked"
        ? "The spot or the vehicle is already in use by another parking session"
        : "The reservation changed in the meantime, reload it and try again",
  });
}

function readId(value: unknown): string | null {
  return typeof value === "string" && ID_PATTERN.test(value) ? value : null;
}

// Unexpected errors go to the app's JSON error handler.
function handle(
  action: (req: Request, res: Response) => Promise<void>,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    action(req, res).catch(next);
  };
}
