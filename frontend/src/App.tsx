import { Routes, Route } from "react-router";
import "./App.css";
import RootLayout from "./layouts/RootLayout";
import ParkingAvailability from "./pages/ParkingAvailability";
import Reservations from "./pages/Reservations";
import Vehicles from "./pages/Vehicles";
import History from "./pages/History";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route index element={<ParkingAvailability />} />
        <Route path="reservations" element={<Reservations />} />
        <Route path="vehicles" element={<Vehicles />} />
        <Route path="history" element={<History />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
