# Frontend

React + TypeScript app built with Vite. Requests to `/api` are proxied to the backend on port 8080 in development.

## Prerequisites

- **Node.js**: version 22 (`^22.12.0`, matches CI and `frontend/Dockerfile`; satisfies Vite 8 and Vitest 5 engine requirements).
- **npm**: version 10 or newer.

## Running

From the repository root:

```bash
npm run dev -w frontend          # start dev server on http://localhost:3000
npm run test -w frontend         # run tests with coverage (non-watch)
npm run test:watch -w frontend   # run tests in interactive watch mode
npm run typecheck -w frontend    # type check with tsc --noEmit
npm run lint -w frontend         # run ESLint
npm run lint:fix -w frontend     # run ESLint with autofix
npm run build -w frontend        # production build into dist/
```

Or start the full stack (frontend + backend):

```bash
npm run dev
```

Full repository validation (required before committing or opening a PR):

```bash
npm run check                    # format:check + lint + typecheck + test + build
npm run format                   # auto-format with Prettier
```

## CI Pipeline (GitHub Actions)

Every pull request and push to `main` runs the **CI** workflow (`.github/workflows/ci.yml`):

1. **`Check` job**:
   - `npm run format:check`: Validates Prettier code formatting.
   - `npm run lint`: Runs ESLint on frontend (`react-hooks`, `typescript-eslint`, browser globals) and backend.
   - `npm run typecheck`: Runs `tsc --noEmit` across all workspaces.
   - `npm run test`: Runs Vitest with coverage in non-watch mode. Fails if any test fails or coverage drops below the 50% threshold (`lines`, `functions`, `branches`, `statements`).
   - `npm run build`: Compiles production builds for all workspaces.
2. **`Docker build` job**: Builds the container image using `frontend/Dockerfile` (Nginx + static build).
3. **`Smoke test` job**: Starts the stack in Docker and verifies `http://localhost:3000/` and API proxy `/api/health`.

## Reproducing Pipeline Failures Locally

| Failure Type         | Local Reproduction              | Resolution                                                             |
| -------------------- | ------------------------------- | ---------------------------------------------------------------------- |
| **Formatting**       | `npm run format:check`          | Run `npm run format` to auto-format files.                             |
| **Linting**          | `npm run lint -w frontend`      | Run `npm run lint:fix -w frontend` or fix React hook / syntax issues.  |
| **Type Check**       | `npm run typecheck -w frontend` | Inspect `tsc --noEmit` errors and fix type definitions.                |
| **Test Failure**     | `npm run test -w frontend`      | Fix failing assertions in `src/**/*.test.{ts,tsx}`.                    |
| **Coverage Failure** | `npm run test -w frontend`      | Add unit tests for uncovered branches/lines to meet the 50% threshold. |
| **Build Failure**    | `npm run build -w frontend`     | Fix import errors or bundle issues reported by Vite.                   |

## Notes & Protected Files

- Core tooling configurations (`/package.json`, `/package-lock.json`, `/eslint.config.js`, `/tsconfig.base.json`, `/.github/`) are protected by `.github/CODEOWNERS`. Changes to these files require project lead approval (`@Jansyler`).
- On Windows, running the full repository `npm run test` or `npm run check` requires local port binding permission for backend supertest integration tests.

## Routes

| Path            | Page                 | Description                             |
| --------------- | -------------------- | --------------------------------------- |
| `/`             | Parking Availability | Current parking spot availability       |
| `/reservations` | My Reservations      | User's parking reservations             |
| `/vehicles`     | My Vehicles          | User's registered vehicles              |
| `/history`      | Parking History      | User's completed and cancelled parkings |
| `*`             | Not Found            | Catch-all for unknown paths             |

## Layout

The shared layout lives in `src/layouts/RootLayout.tsx`. It renders:

- A **header** with the project name and main navigation.
- A **main content area** where the active page appears (via React Router's `<Outlet />`).

All pages share this layout through nested routing defined in `src/App.tsx`.

## Adding a new page

1. Create a component in `src/pages/`, for example `src/pages/MyPage.tsx`:

   ```tsx
   export default function MyPage() {
     return (
       <>
         <h1 className="page-heading">My Page</h1>
         <p className="page-description">Description of the page.</p>
       </>
     );
   }
   ```

2. Add a `<Route>` inside the layout route in `src/App.tsx`:

   ```tsx
   import MyPage from "./pages/MyPage";

   // inside the <Route element={<RootLayout />}> block:
   <Route path="my-page" element={<MyPage />} />;
   ```

3. To add a navigation link, add an entry to the `navItems` array in `src/layouts/RootLayout.tsx`:

   ```tsx
   { to: "/my-page", label: "My Page" },
   ```

4. Add tests for the new route in `src/App.test.tsx`.
