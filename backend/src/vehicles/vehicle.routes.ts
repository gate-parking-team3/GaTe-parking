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

const VEHICLE_ID_PATTERN = /^[a-fA-F0-9]{24}$/;

type VehicleRouterDeps = {
  vehicles: VehicleRepository;
  requireOwner: RequestHandler;
};

export function createVehicleRouter({
  vehicles = mongoVehicleRepository,
  requireOwner = requireVehicleOwner,
}: Partial<VehicleRouterDeps> = {}): Router {
  const router = Router();
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
    handle((req, res) => createVehicle(req, res, vehicles)),
  );
  // PUT replaces all fields, PATCH changes only the fields that are sent.
  router.put(
    "/:id",
    handle((req, res) =>
      updateVehicle(req, res, vehicles, parseCreateVehicle(req.body)),
    ),
  );
  router.patch(
    "/:id",
    handle((req, res) =>
      updateVehicle(req, res, vehicles, parseUpdateVehicle(req.body)),
    ),
  );
  router.delete(
    "/:id",
    handle((req, res) => deleteVehicle(req, res, vehicles)),
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

  res.status(200).json(await vehicles.listByOwner(ownerId));
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

  res.status(200).json(existing);
}

async function createVehicle(
  req: Request,
  res: Response,
  vehicles: VehicleRepository,
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

  const created = await vehicles.create({ ...parsed.value, userId: ownerId });
  res.status(201).json(created);
}

async function updateVehicle(
  req: Request,
  res: Response,
  vehicles: VehicleRepository,
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

  const updated = await vehicles.update(id, parsed.value);
  if (!updated) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }

  res.status(200).json(updated);
}

async function deleteVehicle(
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
    res.status(403).json({ error: "You can only remove your own vehicle" });
    return;
  }

  // No reservation or parking-session model exists, and no soft-delete rule is documented.
  await vehicles.deleteById(id);
  res.status(204).send();
}

function readVehicleId(id: string | string[] | undefined): string | null {
  if (typeof id !== "string" || !VEHICLE_ID_PATTERN.test(id)) return null;
  return id;
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
