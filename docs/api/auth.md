# Authentication and employee access API

Sign-in uses a JSON Web Token (JWT). After login, send it on every protected request:

```
Authorization: Bearer <token>
```

Tokens expire after 8 hours. Logout is done on the frontend by forgetting the token. The account is checked on every request, so disabling an employee or changing their role takes effect immediately, even for tokens already issued.

Errors have the shape `{ "error": "<message>" }`.

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

Running it again for an existing email makes that account an active admin.
