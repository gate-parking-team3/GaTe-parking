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
  type ReservationStore,
} from "./reservation.store.js";

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
        store.findBusySpotIds(lotId, window.value),
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

      const created = await store.createIfFree({
        userId,
        vehicleId,
        spotId,
        lotId: spot.lotId,
        startTime: window.value.start,
        endTime: window.value.end,
      });
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
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: "Not signed in" });
        return;
      }
      const id = readId(req.params.id);
      if (!id) {
        res.status(400).json({ error: "Invalid reservation id" });
        return;
      }
      const reservation = await store.findById(id);
      if (!reservation) {
        res.status(404).json({ error: "Reservation not found" });
        return;
      }
      if (reservation.userId !== user.id && user.role !== "admin") {
        res
          .status(403)
          .json({ error: "You can only view your own reservation" });
        return;
      }
      res.json(reservation);
    }),
  );

  return router;
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
