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
  "userId": "U001"
}
```

| Field          | Rule                                                                        |
| -------------- | --------------------------------------------------------------------------- |
| `licensePlate` | Required. Normalized and validated by the existing plate functions. Unique. |
| `brand`        | Required non-empty text.                                                    |
| `model`        | Required non-empty text.                                                    |
| `engineType`   | `combustion` or `electric`, from the README and `AGENTS.md`.                |
| `size`         | `small`, `standard`, or `large`.                                            |
| `userId`       | Owner. Taken from the authenticated user, never from the request body.      |

Plate checks call `validateLicensePlate`, `normalizeLicensePlate`, and `isLicensePlateUnique` in `backend/src/vehicles/vehicle.validation.ts`.

## Authentication

JWT authentication is not implemented. These routes read `req.user.id` only. Until the auth middleware sets that value, every vehicle route responds with `401`.

A `userId` in the body is ignored on create and rejected on update.

## Endpoints

### `POST /api/vehicles`

Creates a vehicle for the authenticated user. `201` and the vehicle. `400` for invalid fields, `409` when the normalized plate already exists.

### `PATCH /api/vehicles/:id`

Updates the caller's vehicle. The body may include any of `licensePlate`, `brand`, `model`, `engineType`, and `size`. `userId`, `id`, and `_id` are rejected. `200` and the updated vehicle. `400` invalid id or fields, `403` another user's vehicle, `404` missing vehicle, `409` duplicate plate.

### `DELETE /api/vehicles/:id`

Permanently removes the caller's vehicle. `204` on success. `400` invalid id, `403` another user's vehicle, `404` missing vehicle.

No reservation or parking-session model exists, so deletion does not check them. No soft-delete rule is documented.
