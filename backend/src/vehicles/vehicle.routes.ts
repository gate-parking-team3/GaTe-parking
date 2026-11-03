import {
  Router,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import { readOwnerId, requireVehicleOwner } from "./vehicle.auth.js";
import { parseCreateVehicle, parseUpdateVehicle } from "./vehicle.input.js";
import {
  DuplicateLicensePlateError,
  mongoVehicleRepository,
  type VehicleRepository,
} from "./vehicle.repository.js";
import {
  isLicensePlateUnique,
  normalizeLicensePlate,
} from "./vehicle.validation.js";

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
  router.post("/", (req, res) => {
    void respond(res, () => createVehicle(req, res, vehicles));
  });
  router.patch("/:id", (req, res) => {
    void respond(res, () => updateVehicle(req, res, vehicles));
  });
  router.delete("/:id", (req, res) => {
    void respond(res, () => deleteVehicle(req, res, vehicles));
  });
  return router;
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

  const plates = await vehicles.listLicensePlates();
  if (!isLicensePlateUnique(parsed.value.licensePlate, plates)) {
    res.status(409).json({ error: "License plate is already registered" });
    return;
  }

  const created = await vehicles.create({ ...parsed.value, userId: ownerId });
  res.status(201).json(created);
}

async function updateVehicle(
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

  const parsed = parseUpdateVehicle(req.body);
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

  if (
    parsed.value.licensePlate !== undefined &&
    parsed.value.licensePlate !== existing.licensePlate &&
    !isLicensePlateUnique(
      parsed.value.licensePlate,
      await otherPlates(vehicles, existing.licensePlate),
    )
  ) {
    res.status(409).json({ error: "License plate is already registered" });
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

async function otherPlates(
  vehicles: VehicleRepository,
  currentPlate: string,
): Promise<string[]> {
  const plates = await vehicles.listLicensePlates();
  const current = normalizeLicensePlate(currentPlate);
  return plates.filter((plate) => normalizeLicensePlate(plate) !== current);
}

function readVehicleId(id: string | string[] | undefined): string | null {
  if (typeof id !== "string" || !VEHICLE_ID_PATTERN.test(id)) return null;
  return id;
}

async function respond(
  res: Response,
  action: () => Promise<void>,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (res.headersSent) return;

    if (error instanceof DuplicateLicensePlateError) {
      res.status(409).json({ error: "License plate is already registered" });
      return;
    }

    res.status(500).json({ error: "Failed to save the vehicle" });
  }
}
