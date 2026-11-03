export const ENGINE_TYPES = ["combustion", "ev", "hybrid"] as const;

export type EngineType = (typeof ENGINE_TYPES)[number];

const EV_FLAG_ENGINE_TYPES = new Set<EngineType>(["ev"]);

const PLATE_MIN_LENGTH = 2;
const PLATE_MAX_LENGTH = 12;
const NORMALIZED_PLATE_PATTERN = /^[A-Z0-9]+$/;

export type LicensePlateValidationResult =
  | { valid: true; normalized: string }
  | { valid: false; normalized: string; reason: string };

export function normalizeLicensePlate(plate: string): string {
  return plate.toUpperCase().replaceAll(" ", "").replaceAll("-", "");
}

export function validateLicensePlate(
  plate: string,
): LicensePlateValidationResult {
  const normalized = normalizeLicensePlate(plate);

  if (normalized.length === 0) {
    return {
      valid: false,
      normalized,
      reason: "License plate must not be empty",
    };
  }

  if (normalized.length < PLATE_MIN_LENGTH) {
    return {
      valid: false,
      normalized,
      reason: "License plate must contain at least 2 characters",
    };
  }

  if (normalized.length > PLATE_MAX_LENGTH) {
    return {
      valid: false,
      normalized,
      reason: "License plate must contain at most 12 characters",
    };
  }

  if (!NORMALIZED_PLATE_PATTERN.test(normalized)) {
    return {
      valid: false,
      normalized,
      reason: "License plate may contain only letters A-Z and digits 0-9",
    };
  }

  return { valid: true, normalized };
}

export function isLicensePlateUnique(
  plate: string,
  existingPlates: Iterable<string>,
): boolean {
  const normalized = normalizeLicensePlate(plate);

  for (const existingPlate of existingPlates) {
    if (normalizeLicensePlate(existingPlate) === normalized) {
      return false;
    }
  }

  return true;
}

export function hasEvFlag(engineType: string): boolean {
  if (!isEngineType(engineType)) {
    throw new Error(`Unsupported engine type: ${engineType}`);
  }

  return EV_FLAG_ENGINE_TYPES.has(engineType);
}

function isEngineType(engineType: string): engineType is EngineType {
  return (ENGINE_TYPES as readonly string[]).includes(engineType);
}
