# Backend

Node.js + Express + TypeScript API with MongoDB (Mongoose).

```
npm run dev -w backend     # watch mode, needs MongoDB (docker compose up -d mongo)
npm run test -w backend
npm run seed -w backend    # sample users and vehicles, password gate-parking-dev
```

Config via `.env` (see `.env.example`). Health check: `GET /api/health`. API documentation goes in `docs/api/`.
