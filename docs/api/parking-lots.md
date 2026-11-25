# Parking lots and availability (US 1)

Every endpoint requires authentication. Errors use `{ "error": "..." }`.

## `GET /api/lots`

Lists parking lots with their current availability. Each item includes:

```json
{
  "id": "6911bbbb0000000000000001",
  "name": "Main lot",
  "address": "Main Street 1",
  "totalCapacity": 12,
  "evCapacity": 3,
  "disabledCapacity": 1,
  "availability": {
    "total": 12,
    "available": 9,
    "occupied": 2,
    "reserved": 1
  }
}
```

Availability totals are based on the parking spots assigned to each lot. A spot
with an open parking session, an overlapping reservation at the current time,
or an explicit `reserved` / `occupied` spot status is not available.

## `GET /api/lots/:lotId`

Returns the lot, its current availability, and its individual spots:

```json
{
  "id": "6911bbbb0000000000000001",
  "name": "Main lot",
  "address": "Main Street 1",
  "totalCapacity": 12,
  "evCapacity": 3,
  "disabledCapacity": 1,
  "availability": {
    "total": 12,
    "available": 9,
    "occupied": 2,
    "reserved": 1
  },
  "spots": [
    {
      "id": "6911aaaa0000000000000001",
      "spotNumber": "A1",
      "lotId": "6911bbbb0000000000000001",
      "type": "standard",
      "size": "standard",
      "status": "free"
    }
  ]
}
```

For spots currently held by a reservation or an open parking session, the
returned status reflects the current state (`reserved` or `occupied`), even if
the persisted spot status has not yet changed.

- `200`: the lot was found.
- `400`: malformed lot id.
- `404`: no lot has that id.

## `GET /api/lots/:lotId/available-spots` (US 4)

Returns spots that suit the caller's vehicle and are free for the whole
requested time window. See [reservations.md](reservations.md) for query
parameters and response details.
