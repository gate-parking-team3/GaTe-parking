import type {
  ParkingSpotSize,
  ParkingSpotType,
} from "../parks/parkingSpot.types.js";
import type { Role, UserStatus } from "../users/user.js";
import type { VehicleFields } from "../vehicles/vehicle.types.js";

// Development sample data: users, vehicles, parking lots and their spots.
// Reservations are made through the app (US 4), so none are seeded.

// Every sample account signs in with this password. Never used in production.
export const SAMPLE_PASSWORD = "gate-parking-dev";

export type SampleUser = {
  key: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
};

// `owner` is the `key` of a sample user; the seed replaces it with that user's id.
export type SampleVehicle = VehicleFields & { owner: string };

export const SAMPLE_USERS: SampleUser[] = [
  {
    key: "U001",
    name: "Anna Novak",
    email: "anna.novak@example.com",
    role: "user",
    status: "active",
  },
  {
    key: "U002",
    name: "Petr Svoboda",
    email: "petr.svoboda@example.com",
    role: "user",
    status: "active",
  },
  {
    key: "U003",
    name: "Jana Vesela",
    email: "jana.vesela@example.com",
    role: "user",
    status: "active",
  },
  {
    key: "U004",
    name: "Martin Dvorak",
    email: "martin.dvorak@example.com",
    role: "user",
    status: "active",
  },
  {
    key: "U005",
    name: "Eva Prochazka",
    email: "eva.prochazka@example.com",
    role: "admin",
    status: "active",
  },
  {
    key: "U006",
    name: "Tomas Horak",
    email: "tomas.horak@example.com",
    role: "user",
    status: "disabled",
  },
];

export const SAMPLE_VEHICLES: SampleVehicle[] = [
  {
    licensePlate: "1AB2345",
    brand: "Skoda",
    model: "Octavia",
    engineType: "combustion",
    size: "standard",
    owner: "U001",
  },
  {
    licensePlate: "2AC5678",
    brand: "Tesla",
    model: "Model 3",
    engineType: "electric",
    size: "standard",
    owner: "U002",
  },
  {
    licensePlate: "3AD9012",
    brand: "Toyota",
    model: "Corolla",
    engineType: "combustion",
    size: "standard",
    owner: "U003",
  },
  {
    licensePlate: "4AE3456",
    brand: "Hyundai",
    model: "Ioniq 5",
    engineType: "electric",
    size: "standard",
    owner: "U004",
  },
  {
    licensePlate: "5AF7890",
    brand: "Volkswagen",
    model: "Golf",
    engineType: "combustion",
    size: "small",
    owner: "U005",
  },
  {
    licensePlate: "6AG1234",
    brand: "Skoda",
    model: "Superb",
    engineType: "combustion",
    size: "large",
    owner: "U001",
  },
  {
    licensePlate: "7AH5678",
    brand: "Ford",
    model: "Focus",
    engineType: "combustion",
    size: "standard",
    owner: "U006",
  },
];

export type SampleSpot = {
  spotNumber: string;
  type: ParkingSpotType;
  size: ParkingSpotSize;
};

// A lot's capacities are counted from its spots by the seed.
export type SampleLot = { name: string; address: string; spots: SampleSpot[] };

const spots = (
  prefix: string,
  count: number,
  type: ParkingSpotType,
  size: ParkingSpotSize,
  first = 1,
): SampleSpot[] =>
  Array.from({ length: count }, (_, i) => ({
    spotNumber: `${prefix}${first + i}`,
    type,
    size,
  }));

export const SAMPLE_LOTS: SampleLot[] = [
  {
    name: "Main lot",
    address: "Main Street 1",
    spots: [
      ...spots("A", 4, "standard", "standard"),
      ...spots("A", 2, "standard", "small", 5),
      ...spots("B", 2, "standard", "large"),
      ...spots("E", 3, "ev", "standard"),
      ...spots("D", 1, "disabled", "large"),
    ],
  },
  {
    name: "North lot",
    address: "North Street 12",
    spots: [
      ...spots("N", 3, "standard", "standard"),
      ...spots("E", 1, "ev", "large"),
    ],
  },
];
