# Vehicles

Employee vehicles. MongoDB stores `_id`; the API returns `id`.

```json
{
  "id": "6908abc12345678901234567",
  "licensePlate": "1AB2345",
  "brand": "Skoda",
  "model": "Octavia",
  "engineType": "combustion",
  "size": "standard",
  "userId": "6908abc12345678901234568",
  "evCharging": false
}
```

| Field          | Rule                                                                                                                                                                                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `licensePlate` | Required. Spaces and hyphens are removed, letters are upper-cased, 2-12 letters or digits remain. Unique across active users: a clash with an active user's vehicle gives `409`. A vehicle of a disabled or pending user gives up its plate when someone registers it, unless it still has an upcoming or active reservation or is parked. |
| `brand`        | Required non-empty text.                                                                                                                                                                                                                                                                                                                   |
| `model`        | Required non-empty text.                                                                                                                                                                                                                                                                                                                   |
| `engineType`   | `combustion` or `electric`, from the README and `AGENTS.md`.                                                                                                                                                                                                                                                                               |
| `size`         | `small`, `standard`, or `large`.                                                                                                                                                                                                                                                                                                           |
| `userId`       | Owner. Taken from the authenticated user, never from the request body.                                                                                                                                                                                                                                                                     |
| `evCharging`   | Read-only, in responses only. `true` for electric cars: they get EV charging privileges (EV spots, see `reservations.md`).                                                                                                                                                                                                                 |

Plate checks call `validateLicensePlate`, `normalizeLicensePlate`, and `isLicensePlateUnique` in `backend/src/vehicles/vehicle.validation.ts`.

## Authentication

Every route needs `Authorization: Bearer <token>` from `POST /api/auth/login` (see `auth.md`), otherwise `401`. The owner is the signed-in user (`req.user.id`). Vehicles are private: you only see and change your own, other users' vehicles give `403`.

A `userId` in the body is ignored on create and rejected on update. The routes share the `/api` rate limit (see `auth.md`).

Errors are always `{ "error": "..." }`.

## Endpoints

### `GET /api/vehicles`

Lists the caller's vehicles: `200` and an array (empty when there are none).

### `GET /api/vehicles/:id`

`200` and the vehicle. `400` invalid id, `403` another user's vehicle, `404` missing vehicle.

### `POST /api/vehicles`

Creates a vehicle for the authenticated user. `201` and the vehicle. `400` for invalid fields, `409` when the normalized plate already exists.

### `PUT /api/vehicles/:id`

Replaces the caller's vehicle. The body needs all of `licensePlate`, `brand`, `model`, `engineType` and `size` (same rules as `POST`). `200` and the updated vehicle. `400` invalid id or fields, `403` another user's vehicle, `404` missing vehicle, `409` duplicate plate.

### `PATCH /api/vehicles/:id`

Updates the caller's vehicle. The body may include any of `licensePlate`, `brand`, `model`, `engineType`, and `size`. `userId`, `id`, and `_id` are rejected. `200` and the updated vehicle. `400` invalid id or fields, `403` another user's vehicle, `404` missing vehicle, `409` duplicate plate.

### `DELETE /api/vehicles/:id`

Permanently removes the caller's vehicle. `204` on success. `400` invalid id, `403` another user's vehicle, `404` missing vehicle, `409` when the vehicle has a `reserved` reservation that has not ended, an `active` reservation, or an open parking session. Cancel or finish those first.
