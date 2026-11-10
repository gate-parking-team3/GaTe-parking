# Parking lots and reservations (US 4, US 3, US 11)

Booking a parking spot for a vehicle and a time window (US 4), editing an upcoming booking (US 11), then starting and ending the parking (US 3). MongoDB stores `_id`; the API returns `id`.

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

| Rule            | Detail                                                                                                                                                                                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Time window     | ISO date-times. `endTime` must be after `startTime`. `startTime` may be at most 5 minutes in the past.                                                                                                                                                           |
| Overlap         | Windows overlap when each starts before the other ends. Back-to-back bookings (one ends at 10:00, the next starts at 10:00) are allowed.                                                                                                                         |
| Blocking        | Reservations with status `reserved` or `active` hold their spot and their vehicle. `completed` and `cancelled` free them. A parking session also holds its spot: from entry to exit, and while the car is still parked, for windows starting by now (see below). |
| One per vehicle | A vehicle cannot hold two overlapping reservations, even on different spots.                                                                                                                                                                                     |
| Suitability     | A vehicle fits a spot of its own size or larger. EV spots are for electric cars only. Combustion cars get standard spots. Electric cars get EV and standard spots.                                                                                               |
| Disabled spots  | Offered only to entitled users. Users have no such flag yet, so disabled spots are never offered (`DISABLED_ALLOWED` in `backend/src/reservations/reservation.routes.ts`).                                                                                       |
| Spot status     | Availability for a window is computed from reservations and sessions. Booking does not change the spot's `status` field.                                                                                                                                         |

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

### `PATCH /api/reservations/:id` (US 11)

Edit an upcoming reservation. Its owner or an admin can call it, only while the reservation is `reserved` and its `startTime` is still in the future.

Body: any of `{ startTime, endTime, vehicleId, spotId }`. Missing fields keep their current value. The merged result is checked like a new booking: valid time window, a vehicle of the reservation's owner (also when an admin edits it), a spot that suits the vehicle. The lot is taken from the spot. The reservation's own current window never conflicts with the edit.

- `200` the updated reservation.
- `400` empty body (none of the four fields), invalid id or time window.
- `403` someone else's reservation.
- `404` reservation or spot not found, or a vehicle that is not the owner's.
- `422` the spot does not suit the vehicle.
- `409` the reservation is not upcoming and `reserved` (started, completed, cancelled or its start has passed), the spot or the vehicle is already booked by another reservation for an overlapping window, or the reservation changed while it was being saved (reload and retry).

### `POST /api/reservations/:id/start` (US 3)

Check-in ("Start Parking"). No body. Only the reservation's owner can call it (admins too get `403`), only while the reservation is `reserved` and only inside its window (`startTime <= now < endTime`). Sets the reservation to `active` and opens a parking session with `entryTime` = now.

- `200` `{ reservation, session }`:

```json
{
  "reservation": {
    "id": "6911c0ffee0000000000abcd",
    "userId": "6908abc12345678901234568",
    "vehicleId": "6908abc12345678901234567",
    "spotId": "6911aaaa0000000000000001",
    "lotId": "6911bbbb0000000000000001",
    "status": "active",
    "startTime": "2026-11-10T09:00:00.000Z",
    "endTime": "2026-11-10T11:00:00.000Z"
  },
  "session": {
    "id": "6911d00d0000000000000001",
    "spotId": "6911aaaa0000000000000001",
    "vehicleId": "6908abc12345678901234567",
    "reservationId": "6911c0ffee0000000000abcd",
    "entryTime": "2026-11-10T09:02:13.000Z",
    "exitTime": null
  }
}
```

- `400` malformed id, `403` someone else's reservation, `404` not found.
- `409` the reservation is not `reserved` (already started, completed or cancelled, also when two starts race), or the spot or the vehicle still has an open parking session (for example the previous driver has not left yet).
- `422` outside the reservation window.

### `POST /api/reservations/:id/end` (US 3)

Check-out ("End Parking"). No body. Owner only, and only while the reservation is `active`; ending after `endTime` is allowed. Sets the reservation to `completed` and the session's `exitTime` to now.

- `200` `{ reservation, session }` with `status: "completed"` and `exitTime` set.
- `400`, `403`, `404` as for start. `409` the reservation is not `active`.

### Parking and spot status

The reservation keeps its booked `startTime`/`endTime`; the real arrival and departure are the session's `entryTime`/`exitTime`. The spot's `status` field is not written. A spot is occupied while it has an open session (`exitTime` null). An open session blocks windows that start by now, also when the driver stays past `endTime`, but not later windows: nobody knows when the car leaves, and its active reservation already holds the booked window. If the car is still there when the next booking starts, that check-in gets `409`. After the end, the completed reservation no longer blocks the spot, so the rest of the window is free again. The database allows one open session per spot and per vehicle.

Start opens the session before switching the status, and end closes the session before switching it. A start or end that stopped halfway (e.g. a database error) can simply be retried.

## Sample data

`npm run seed -w backend` adds two lots ("Main lot" with 12 spots, "North lot" with 4) covering every spot type and size.
