# Authentication and employee access API

Sign-in uses a JSON Web Token (JWT). After login, send it on every protected request:

```
Authorization: Bearer <token>
```

Tokens expire after 8 hours. Logout is done on the frontend by forgetting the token. The account is checked on every request, so disabling an employee or changing their role takes effect immediately, even for tokens already issued.

Requests are rate limited per IP address over 15 minutes: 10 failed logins (successful logins do not count) and 300 requests to the signed-in endpoints. Over the limit the API answers `429` with `{ "error": "..." }` and a `RateLimit` header saying when to retry.

Errors have the shape `{ "error": "<message>" }`. A malformed JSON body gets 400 `Invalid request`; an unexpected server failure gets 500 `Something went wrong`.

## User

```json
{
  "id": "6720f1...",
  "email": "petr@gate.cz",
  "name": "Petr",
  "role": "user",
  "status": "active"
}
```

| Field    | Values                                                                                     |
| -------- | ------------------------------------------------------------------------------------------ |
| `role`   | `user`, `admin`                                                                            |
| `status` | `pending` (registered, waiting for approval), `active` (may sign in), `disabled` (blocked) |

The password hash is never returned.

## Endpoints

### `POST /api/auth/login`

Body: `{ "email": "petr@gate.cz", "password": "..." }`. The email is case-insensitive.

| Status | Body                                                          |
| ------ | ------------------------------------------------------------- |
| 200    | `{ "token": "...", "user": User }`                            |
| 400    | Email or password missing                                     |
| 401    | `Wrong email or password` (same message for an unknown email) |
| 403    | `Account is waiting for approval` or `Account is disabled`    |

### `GET /api/auth/me`

Signed-in users. Returns `{ "user": User }`, or 401 when the token is missing, invalid or expired, or the account is no longer active.

### `GET /api/admin/employees`

Admins only (401 when not signed in, 403 for non-admins). Returns `{ "employees": User[] }` sorted by name.

### `GET /api/admin/employees/:id`

Admins only. Returns `{ "employee": User }`, or 404.

### `PATCH /api/admin/employees/:id`

Admins only. Changes an employee's role and/or access status. Send one or both:

```json
{ "role": "admin", "status": "active" }
```

Use it to approve a pending employee (`status: active`), block one (`status: disabled`) or make someone an admin. Returns `{ "employee": User }`, 400 for invalid values or when admins try to remove their own admin access, or 404.

## Protecting your own endpoints

```ts
import { requireAuth, requireRole } from "./auth/middleware.js";

router.get("/mine", requireAuth(users, jwtSecret), (req, res) => {
  // req.user is the signed-in, active user
});
router.delete(
  "/:id",
  requireAuth(users, jwtSecret),
  requireRole("admin"),
  handler,
);
```

## First admin

Nobody can approve accounts until an admin exists. Create one locally (MongoDB must be running):

```
npm run create-admin -w backend -- hynek@gate.cz "Hynek" "a-strong-password"
```

The password needs at least 8 characters and at most 72 bytes (bcrypt ignores anything longer). Running it again for an existing email makes that account an active admin; its name and password stay unchanged.

## Employee invitations and activation

Invitation links expire after 24 hours and can be used once.

### `POST /api/admin/employees`

Admins only (401 when not signed in, 403 for non-admins). Send either a `name` or both `firstName` and `lastName`, plus an email:

```json
{ "firstName": "Jana", "lastName": "Nova", "email": "jana@gate.cz" }
```

Names must be 2–150 characters after trimming. The email must be valid and at most 254 characters; it is trimmed and lower-cased. On success, returns 201 with `{ "employee": User }`. Returns 400 with `{ "error": "Valid name and email are required" }` for invalid input, or 409 with `{ "error": "Email already registered" }` when the email is already in use.

The API does not send invitation emails yet. In non-production environments, an admin can retrieve the invitation from the development-only inbox.

### `POST /api/auth/activate`

Public endpoint. Activate an account with the 64-character hexadecimal invitation token and choose a password:

```json
{ "token": "<invitation-token>", "password": "a-strong-password" }
```

The password must meet the length limits described under [First admin](#first-admin). Returns `{ "user": User }` on success. Returns 400 with `{ "error": "Invalid token or password (8+ characters, max 72 bytes)" }` for invalid input, or `{ "error": "Activation link is invalid, expired or already used" }` when the invitation cannot be used.

### `GET /api/dev/invitations/:email`

Development only; this endpoint is not mounted in production. Requires an admin bearer token. Returns `{ "activationUrl": "...", "expiresAt": "..." }`, or 404 with `{ "error": "Invitation not found" }` if there is no invitation in the in-memory development inbox. Use the token from the activation URL in the `POST /api/auth/activate` request.
