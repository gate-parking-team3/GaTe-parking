import type { Role, UserStatus } from "../users/user.js";
import type { VehicleFields } from "../vehicles/vehicle.types.js";

// Development sample data. Only users and vehicles exist in the backend so far;
// parking lots, spots, reservations, visits and chargers come with their models.

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
