import { Routes, Route } from "react-router";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import RootLayout from "./layouts/RootLayout";
import ActivityHistory from "./pages/ActivityHistory";
import AdminSpots from "./pages/AdminSpots";
import History from "./pages/History";
import Login from "./pages/Login";
import Activate from "./pages/Activate";
import Book from "./pages/Book";
import Employees from "./pages/Employees";
import NotFound from "./pages/NotFound";
import Notifications from "./pages/Notifications";
import ParkingAvailability from "./pages/ParkingAvailability";
import Reservations from "./pages/Reservations";
import ReservationDetail from "./pages/ReservationDetail";
import Vehicles from "./pages/Vehicles";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="login" element={<Login />} />
          <Route path="activate" element={<Activate />} />
          <Route element={<ProtectedRoute />}>
            <Route index element={<ParkingAvailability />} />
            <Route path="book" element={<Book />} />
            <Route path="reservations" element={<Reservations />} />
            <Route path="reservations/:id" element={<ReservationDetail />} />
            <Route path="vehicles" element={<Vehicles />} />
            <Route path="history" element={<History />} />
            <Route path="notifications" element={<Notifications />} />
          </Route>
          <Route element={<ProtectedRoute requiredRole="admin" />}>
            <Route path="admin/employees" element={<Employees />} />
            <Route path="admin/spots" element={<AdminSpots />} />
            <Route
              path="admin/activity-history"
              element={<ActivityHistory />}
            />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
