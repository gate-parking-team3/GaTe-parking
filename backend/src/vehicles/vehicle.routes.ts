import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import { readOwnerId, requireVehicleOwner } from "./vehicle.auth.js";
import {
  parseCreateVehicle,
  parseUpdateVehicle,
  type VehicleUpdate,
} from "./vehicle.input.js";
import {
  DuplicateLicensePlateError,
  mongoVehicleRepository,
  type VehicleRepository,
} from "./vehicle.repository.js";
import type { VehicleRecord } from "./vehicle.types.js";
import { mongoVehicleUsage, type VehicleUsage } from "./vehicle.usage.js";

const VEHICLE_ID_PATTERN = /^[a-fA-F0-9]{24}$/;

type VehicleRouterDeps = {
  vehicles: VehicleRepository;
  requireOwner: RequestHandler;
  usage: VehicleUsage;
  now: () => Date;
};

export function createVehicleRouter({
  vehicles = mongoVehicleRepository,
  requireOwner = requireVehicleOwner,
  usage = mongoVehicleUsage(),
  now = () => new Date(),
}: Partial<VehicleRouterDeps> = {}): Router {
  const router = Router();
  // A duplicate plate gets one retry when the plate only belongs to an inactive user's vehicle.
  const savePlate = async <T>(
    plate: string | undefined,
    save: () => Promise<T>,
  ): Promise<T> => {
    try {
      return await save();
    } catch (error) {
      if (
        error instanceof DuplicateLicensePlateError &&
        plate !== undefined &&
        (await usage.releasePlate(plate, now()))
      ) {
        return save();
      }
      throw error;
    }
  };
  router.use(requireOwner);
  router.get(
    "/",
    handle((req, res) => listVehicles(res, vehicles)),
  );
  router.get(
    "/:id",
    handle((req, res) => getVehicle(req, res, vehicles)),
  );
  router.post(
    "/",
    handle((req, res) => createVehicle(req, res, vehicles, savePlate)),
  );
  // PUT replaces all fields, PATCH changes only the fields that are sent.
  router.put(
    "/:id",
    handle((req, res) =>
      updateVehicle(
        req,
        res,
        vehicles,
        savePlate,
        parseCreateVehicle(req.body),
      ),
    ),
  );
  router.patch(
    "/:id",
    handle((req, res) =>
      updateVehicle(
        req,
        res,
        vehicles,
        savePlate,
        parseUpdateVehicle(req.body),
      ),
    ),
  );
  router.delete(
    "/:id",
    handle((req, res) => deleteVehicle(req, res, vehicles, usage, now())),
  );
  return router;
}

async function listVehicles(
  res: Response,
  vehicles: VehicleRepository,
): Promise<void> {
  const ownerId = readOwnerId(res);
  if (!ownerId) {
    res.status(401).json({ error: "Authentication is required" });
    return;
  }

  res.status(200).json((await vehicles.listByOwner(ownerId)).map(toResponse));
}

async function getVehicle(
  req: Request,
  res: Response,
  vehicles: VehicleRepository,
): Promise<void> {
  const ownerId = readOwnerId(res);
  if (!ownerId) {
    res.status(401).json({ error: "Authentication is required" });
    return;
  }

  const id = readVehicleId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid vehicle id" });
    return;
  }

  const existing = await vehicles.findById(id);
  if (!existing) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }

  if (existing.userId !== ownerId) {
    res.status(403).json({ error: "You can only view your own vehicle" });
    return;
  }

  res.status(200).json(toResponse(existing));
}

async function createVehicle(
  req: Request,
  res: Response,
  vehicles: VehicleRepository,
  savePlate: SavePlate,
): Promise<void> {
  const ownerId = readOwnerId(res);
  if (!ownerId) {
    res.status(401).json({ error: "Authentication is required" });
    return;
  }

  const parsed = parseCreateVehicle(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const input = { ...parsed.value, userId: ownerId };
  const created = await savePlate(input.licensePlate, () =>
    vehicles.create(input),
  );
  res.status(201).json(toResponse(created));
}

async function updateVehicle(
  req: Request,
  res: Response,
  vehicles: VehicleRepository,
  savePlate: SavePlate,
  parsed: ParsedUpdate,
): Promise<void> {
  const ownerId = readOwnerId(res);
  if (!ownerId) {
    res.status(401).json({ error: "Authentication is required" });
    return;
  }

  const id = readVehicleId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid vehicle id" });
    return;
  }

  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const existing = await vehicles.findById(id);
  if (!existing) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }

  if (existing.userId !== ownerId) {
    res.status(403).json({ error: "You can only change your own vehicle" });
    return;
  }

  const patch = parsed.value;
  const updated = await savePlate(patch.licensePlate, () =>
    vehicles.update(id, patch),
  );
  if (!updated) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }

  res.status(200).json(toResponse(updated));
}

async function deleteVehicle(
  req: Request,
  res: Response,
  vehicles: VehicleRepository,
  usage: VehicleUsage,
  now: Date,
): Promise<void> {
  const ownerId = readOwnerId(res);
  if (!ownerId) {
    res.status(401).json({ error: "Authentication is required" });
    return;
  }

  const id = readVehicleId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid vehicle id" });
    return;
  }

  const existing = await vehicles.findById(id);
  if (!existing) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }

  if (existing.userId !== ownerId) {
    res.status(403).json({ error: "You can only remove your own vehicle" });
    return;
  }

  if (await usage.isInUse(id, now)) {
    res.status(409).json({
      error:
        "The vehicle has an upcoming or active reservation or is parked right now",
    });
    return;
  }

  await vehicles.deleteById(id);
  res.status(204).send();
}

function readVehicleId(id: string | string[] | undefined): string | null {
  if (typeof id !== "string" || !VEHICLE_ID_PATTERN.test(id)) return null;
  return id;
}

type SavePlate = <T>(
  plate: string | undefined,
  save: () => Promise<T>,
) => Promise<T>;

// US 5: electric cars get EV charging privileges (EV spots, see reservations/reservation.rules.ts).
function toResponse(vehicle: VehicleRecord) {
  return { ...vehicle, evCharging: vehicle.engineType === "electric" };
}

type ParsedUpdate =
  { ok: true; value: VehicleUpdate } | { ok: false; error: string };

// Only a duplicate plate is expected here (the unique index decides). Anything else goes to
// the app's error handler, which logs it and answers with a generic 500.
function handle(
  action: (req: Request, res: Response) => Promise<void>,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    action(req, res).catch((error: unknown) => {
      if (res.headersSent) {
        next(error);
        return;
      }
      if (error instanceof DuplicateLicensePlateError) {
        res.status(409).json({ error: "License plate is already registered" });
        return;
      }
      next(error);
    });
  };
}
