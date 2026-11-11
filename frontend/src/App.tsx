import { Routes, Route } from "react-router";
import "./App.css";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import RootLayout from "./layouts/RootLayout";
import History from "./pages/History";
import Login from "./pages/Login";
import Activate from "./pages/Activate";
import Employees from "./pages/Employees";
import NotFound from "./pages/NotFound";
import ParkingAvailability from "./pages/ParkingAvailability";
import Reservations from "./pages/Reservations";
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
            <Route path="reservations" element={<Reservations />} />
            <Route path="vehicles" element={<Vehicles />} />
            <Route path="history" element={<History />} />
          </Route>
          <Route element={<ProtectedRoute requiredRole="admin" />}>
            <Route path="admin/employees" element={<Employees />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
