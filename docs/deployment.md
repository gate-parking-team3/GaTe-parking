# Deployment

| Part     | Host                     | Config                      | Deploys                                    |
| -------- | ------------------------ | --------------------------- | ------------------------------------------ |
| Frontend | Vercel (service)         | `vercel.json`, `frontend/`  | Every push to `main`, preview for every PR |
| Backend  | Vercel (service)         | `vercel.json`, `backend/`   | Every push to `main`, preview for every PR |
| Database | MongoDB Atlas (M0, free) | Vercel environment variable | Not deployed, data lives in Atlas          |

One Vercel project deploys both parts as **services** (`vercel.json` in the repository root). Requests to `/api/*` go to the `backend` service, everything else to the `frontend` service, so the app stays on one domain (no CORS or cookie issues) and the frontend code calls `/api/...` exactly as in local development. The services do not call each other, so no service bindings are needed.

How the backend runs on Vercel: `backend/src/index.ts` exports the Express app (a serverless function cannot call `listen()`), and `backend/src/serverless.ts` connects to MongoDB on the first request. Vercel runs `npm run build:vercel`, which bundles the app into one ES module (`backend/dist/index.mjs`). The committed `backend/index.mjs` is the entrypoint and re-exports that bundle. Locally and in Docker the server still starts from `backend/src/server.ts`.

Deep links such as `/reservations` work because `vercel.json` rewrites every path without a file extension to the frontend's `index.html`.

## One-time setup (maintainer)

### 1. MongoDB Atlas

1. Create a free **M0** cluster.
2. **Database Access**: add a user with a long generated password and the `readWrite` role.
3. **Network Access**: allow `0.0.0.0/0`. Vercel functions have no fixed outgoing IP, so the password is what protects the database.
4. **Connect → Drivers**: copy the connection string and add the database name: `mongodb+srv://<user>:<password>@<cluster>/gate-parking?retryWrites=true&w=majority`.

### 2. Vercel

1. **Add New → Project**, import this repository. Leave **Root Directory** empty (the repository root) and set the **Framework Preset** to **Services**.
2. Add these **Environment Variables** (Production and Preview):
   - `MONGODB_URI`: the Atlas connection string from step 1.
   - `JWT_SECRET`: a long random string.
   - `TRUST_PROXY`: `1`, so rate limiting sees real visitor IPs behind Vercel's proxy.
3. Deploy, then open `https://<vercel-url>/api/health`. It must return `{"status":"ok","db":"up"}`.

## Day to day

- Merging a PR into `main` deploys both services. Nobody deploys by hand.
- Every PR gets a Vercel preview link. Previews use the same database as production when you give them the same `MONGODB_URI`, so do not test destructive actions there.
- Secrets live only in the Vercel project settings, never in the repository.
- `vercel dev` runs both services together on your machine.

## Known limits

- **Notifications (US 8)**: the backend normally checks reservations for due notifications every minute from a timer in `server.ts`. A serverless function has no long-running timer, so on Vercel that check does not run until it is moved to a scheduled job (not set up yet).
- **Atlas M0** has 512 MB of storage and no automatic backups.

## Docker and Render (optional)

`docker compose up --build` still runs the full stack in containers, and `render.yaml` still describes a Render deployment of the backend Docker image. Neither is used by the Vercel setup above.

## Backup and restore

Needs the [MongoDB Database Tools](https://www.mongodb.com/docs/database-tools/) and the Atlas connection string:

```bash
mongodump --uri "$MONGODB_URI" --out backup-$(date +%F)
```

```bash
mongorestore --uri "$MONGODB_URI" --drop backup-YYYY-MM-DD
```

`--drop` replaces the existing collections, so only restore when you mean to overwrite the live data. Keep backups out of the repository.
