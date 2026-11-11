import { Routes, Route } from "react-router";
import "./App.css";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import RootLayout from "./layouts/RootLayout";
import History from "./pages/History";
import Login from "./pages/Login";
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
          <Route element={<ProtectedRoute />}>
            <Route index element={<ParkingAvailability />} />
            <Route path="reservations" element={<Reservations />} />
            <Route path="vehicles" element={<Vehicles />} />
            <Route path="history" element={<History />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
