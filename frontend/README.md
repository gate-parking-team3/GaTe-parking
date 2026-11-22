# Frontend

React + TypeScript app built with Vite. Requests to `/api` are proxied to the backend on port 8080 in development.

## Running

From the repository root:

```
npm run dev -w frontend    # start the dev server on http://localhost:3000
npm run test -w frontend   # run tests with coverage
npm run build -w frontend  # production build
```

Or start the full stack (frontend + backend):

```
npm run dev
```

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
