# Parking lots and reservations (US 4)

Booking a parking spot for a vehicle and a time window. MongoDB stores `_id`; the API returns `id`.

```json
{
  "id": "6911c0ffee0000000000abcd",
  "userId": "6908abc12345678901234568",
  "vehicleId": "6908abc12345678901234567",
  "spotId": "6911aaaa0000000000000001",
  "lotId": "6911bbbb0000000000000001",
  "status": "reserved",
  "startTime": "2026-11-10T09:00:00.000Z",
  "endTime": "2026-11-10T11:00:00.000Z"
}
```

## Rules

| Rule            | Detail                                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Time window     | ISO date-times. `endTime` must be after `startTime`. `startTime` may be at most 5 minutes in the past.                                                                     |
| Overlap         | Windows overlap when each starts before the other ends. Back-to-back bookings (one ends at 10:00, the next starts at 10:00) are allowed.                                   |
| Blocking        | Reservations with status `reserved` or `active` hold their spot and their vehicle. `completed` and `cancelled` free them. A parking session also holds its spot.           |
| One per vehicle | A vehicle cannot hold two overlapping reservations, even on different spots.                                                                                               |
| Suitability     | A vehicle fits a spot of its own size or larger. EV spots are for electric cars only. Combustion cars get standard spots. Electric cars get EV and standard spots.         |
| Disabled spots  | Offered only to entitled users. Users have no such flag yet, so disabled spots are never offered (`DISABLED_ALLOWED` in `backend/src/reservations/reservation.routes.ts`). |
| Spot status     | Availability for a window is computed from reservations and sessions. Booking does not change the spot's `status` field.                                                   |

The rules live in `backend/src/reservations/reservation.rules.ts` (`spotSuitsVehicle`, `windowsOverlap`, `parseTimeWindow`, `BLOCKING_STATUSES`) so other stories reuse them instead of rewriting them.

## Authentication

Every route needs `Authorization: Bearer <token>` (see `auth.md`), otherwise `401`. The caller is the signed-in user. Errors are always `{ "error": "..." }`. The routes share the `/api` rate limit.

## Endpoints

### `GET /api/lots`

All parking lots: `200` and an array of `{ id, name, address, totalCapacity, evCapacity, disabledCapacity }`.

### `GET /api/lots/:lotId/available-spots?vehicleId=&start=&end=&evOnly=true`

Spots in the lot that suit the vehicle and are free for the whole window. `evOnly=true` keeps EV spots only.

- `200` `{ lotId, start, end, spots: [{ id, spotNumber, lotId, type, size, status }] }`
- `400` invalid id or time window, `404` unknown lot or a vehicle that is not the caller's.

### `POST /api/reservations`

Body: `{ vehicleId, spotId, startTime, endTime }`. The lot is taken from the spot and the owner from the token.

- `201` the new reservation with status `reserved`.
- `400` invalid id or time window.
- `404` unknown spot, or a vehicle that is not the caller's.
- `422` the spot does not suit the vehicle.
- `409` the spot or the vehicle is already booked for an overlapping window (also when two people book the same spot at the same moment).

### `GET /api/reservations/mine`

The caller's reservations in every status, latest `startTime` first: `200` and an array.

### `GET /api/reservations/:id`

One reservation, for its owner or an admin: `200`. `400` malformed id, `403` someone else's, `404` not found.

## Sample data

`npm run seed -w backend` adds two lots ("Main lot" with 12 spots, "North lot" with 4) covering every spot type and size.
