# Notifications (US 8)

All endpoints require `Authorization: Bearer <token>` and return JSON except successful mark-read (`204`). The API uses MongoDB and persists in-app notifications. Web push is optional and not implemented here.

The backend starts a scheduler after the database connects and checks events once per minute. Events are unique by `(reservationId, type)`, so a restart or concurrent scheduler run cannot send the same event type twice. By default all notification types are enabled. Disabled types are not stored.

## Events

| Type               | Condition                                                                                                                                                    | Message recipient        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| `start_soon`       | A `reserved` reservation starts within the next 30 minutes                                                                                                   | Reservation owner        |
| `end_soon`         | A `reserved` or `active` reservation ends within the next 15 minutes                                                                                         | Reservation owner        |
| `cancelled`        | A reservation's status is `cancelled`                                                                                                                        | Reservation owner        |
| `deleted`          | US 6 deletes a reservation and invokes `notifyReservationDeleted` with the reservation snapshot                                                              | Former reservation owner |
| `spot_unavailable` | During the reserved window, an open parking session on its spot belongs to a different reservation, or the spot is marked `occupied` without an open session | Reservation owner        |

Each event type is stored at most once for each reservation, including across restarts. The scheduler does not modify spot availability or reservation statuses. It only creates notifications. `deleted` is event-driven because a deleted reservation cannot be discovered by polling the reservations table.

### `GET /api/notifications`

Returns `200` with only the caller's notifications, newest first. A record looks like:

```json
{
  "id": "6911c0ffee0000000000abcd",
  "userId": "6908abc12345678901234568",
  "reservationId": "6911bbbb0000000000000001",
  "type": "start_soon",
  "title": "Parking starts soon",
  "message": "Your reservation starts in 30 minutes or less.",
  "createdAt": "2026-11-10T08:30:00.000Z",
  "readAt": null,
  "reservationUrl": "/reservations/6911bbbb0000000000000001"
}
```

For deleted reservations, the detail route may respond `404`; the client should still show the notification message.

### `PATCH /api/notifications/:id/read`

Marks an owned notification as read. `204` success, `400` invalid id, `404` not found or belongs to another user. A second mark-read succeeds.

### `GET /api/notifications/settings`

Returns `200` and a per-user object of notification preferences. All `true` by default:

```json
{
  "start_soon": true,
  "end_soon": true,
  "cancelled": true,
  "deleted": true,
  "spot_unavailable": true
}
```

### `PATCH /api/notifications/settings`

Body: one or more valid notification-type fields with **boolean** values, e.g. `{ "start_soon": false }`. `200` returns the full updated preferences. `400` for empty, unknown or non-boolean fields. Settings are account-specific; changing preferences does not delete old notifications.

## Integration with US 6

`DELETE /api/reservations/:id` calls `notifyReservationDeleted` with the reservation it loaded, right after a successful delete. If that fails, the error is logged and the delete still returns `204`.

## Operational considerations

The scheduler is started in `backend/src/server.ts`, not on each HTTP request. This is designed for **one backend process**; the MongoDB unique index still prevents duplicates if multiple instances perform the same check. Cancellations are picked up when the reservation was updated in the last two minutes, so a backend that is down for longer misses them. In-app notifications are durable; no external push delivery is attempted.
