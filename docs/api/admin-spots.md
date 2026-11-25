# Admin parking spots and audit log (US 10)

Administrators create parking spots and read the activity history. MongoDB stores `_id`; the API returns `id`. The signed-in admin is taken from the access token. A `userId` or `createdAt` in the body is ignored.

These routes do not change `GET /api/lots` or reservation availability. A new spot is stored with the status the admin sent (`free` when omitted). Availability keeps using the spot's status as it already does.

## Authentication

Every route below needs `Authorization: Bearer <token>` and an `admin` role (see `auth.md`). Otherwise `401` `{ "error": "Not signed in" }` or `403` `{ "error": "Not allowed" }`. The routes share the `/api` rate limit.

Errors are always `{ "error": "..." }`.

## Parking spot

```json
{
  "id": "6908abc12345678901234567",
  "spotNumber": "A-101",
  "lotId": "6908abc12345678901234568",
  "type": "standard",
  "size": "large",
  "status": "free"
}
```

| Field        | Rule                                                                             |
| ------------ | -------------------------------------------------------------------------------- |
| `spotNumber` | Required. Trimmed and upper-cased. Letters `A-Z`, digits `0-9` and hyphens only. |
| `lotId`      | Required. The parking lot must already exist.                                    |
| `type`       | `standard`, `disabled` or `ev`.                                                  |
| `size`       | `small`, `standard` or `large`.                                                  |
| `status`     | `free`, `reserved` or `occupied`. Omitted means `free`.                          |

`spotNumber` is unique per lot. The same number may exist in another lot. The unique index is `{ lotId: 1, spotNumber: 1 }`.

Capacity counts every spot in the lot, including `reserved` and `occupied`. A create is refused when:

- the lot would have more spots than `totalCapacity`
- an `ev` spot would pass `evCapacity`
- a `disabled` spot would pass `disabledCapacity`
- a `standard` spot would pass `totalCapacity - evCapacity - disabledCapacity`

The lot's capacity numbers are not increased. A full lot returns the total-capacity error. A type error is returned only when that type is full and the lot still has room in the total.

### `POST /api/admin/spots`

`201` and `{ "spot": ParkingSpot }`.

```json
{
  "spotNumber": " a-101 ",
  "lotId": "6908abc12345678901234568",
  "type": "standard",
  "size": "large"
}
```

```json
{
  "spot": {
    "id": "6908abc12345678901234567",
    "spotNumber": "A-101",
    "lotId": "6908abc12345678901234568",
    "type": "standard",
    "size": "large",
    "status": "free"
  }
}
```

The audit text for that spot in a lot named North Lot is `Created parking spot A-101 in lot North Lot`.

| Status | When                                                                 |
| ------ | -------------------------------------------------------------------- |
| 201    | Spot and audit row were both saved.                                  |
| 400    | Missing or invalid body.                                             |
| 401    | Not signed in.                                                       |
| 403    | Signed in, but not an admin.                                         |
| 404    | `lotId` does not match a parking lot.                                |
| 409    | Duplicate spot number in that lot, or the lot's capacity is reached. |
| 500    | Unexpected failure. A spot is not kept when the audit row fails.     |

### `GET /api/admin/spots`

`200` and `{ "spots": ParkingSpot[] }`, sorted by spot number. An empty lot or a fresh database returns `{ "spots": [] }`.

Optional query `lotId`: only that lot's spots. An unknown `lotId` is an empty list, not `404`. A blank or repeated `lotId` is `400`.

## Audit log

Stored fields are `userId`, `action`, `actionType` and `createdAt`. The user's name and email are not stored; they are read from the user record when the history is loaded. `createdAt` is set by the server. `actionType` for this story is `spot.created`. Further stories can add values to that list.

Deactivating an employee (`status: disabled`) does not remove their rows. The API has no permanent user delete, so there is nothing that removes a user's audit rows.

### `GET /api/admin/audit-logs`

`200` and `{ "logs": AuditLogEntry[] }`, newest first, for every user. No rows is `{ "logs": [] }`.

```json
{
  "logs": [
    {
      "id": "6908abc12345678901234569",
      "user": {
        "id": "6908abc12345678901234561",
        "name": "Eva",
        "email": "eva.prochazka@example.com"
      },
      "action": "Created parking spot A-101 in lot North Lot",
      "createdAt": "2026-11-24T08:00:00.000Z"
    }
  ]
}
```

If the user id is missing from the user collection, `name` and `email` are empty strings and `id` is still the stored user id.

The current admin pages call this route with no query. Filters and pages are optional and can be combined.

| Query        | Rule                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------- |
| `userId`     | Only that user's rows. Blank is `400`.                                                       |
| `actionType` | `spot.created`. Anything else is `400`.                                                      |
| `dateFrom`   | Inclusive start. A calendar day (`2026-11-24`) starts at `00:00:00.000Z`. An instant is UTC. |
| `dateTo`     | Inclusive end. A calendar day ends at `23:59:59.999Z`.                                       |
| `page`       | Whole number from 1. Must be sent together with `pageSize`.                                  |
| `pageSize`   | Whole number from 1. Must be sent together with `page`.                                      |

Without `page` and `pageSize`, every matching row is returned. `dateFrom` later than `dateTo` is `400`.

## Consistency

Creating a spot and its audit row is not a MongoDB transaction: this service does not use transactions, and the local MongoDB container is a single server. In one backend process the creates for a lot run one at a time. After the spot is inserted, the capacity is counted again and the spot is deleted if the lot would be over the limit. If the audit insert then fails, the spot is deleted before the `500` response. A crash between those two writes can leave a spot without an audit row. Two backend processes can both pass the count; each then deletes its own spot if the lot is over capacity, so the stored spots do not stay above the limit. The unique index still stops a duplicate number.
