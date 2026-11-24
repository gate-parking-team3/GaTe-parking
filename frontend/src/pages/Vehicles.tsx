import { useState } from "react";
import AddVehicleModal from "../components/AddVehicleModal";
import VehicleList from "../components/VehicleList";

export default function Vehicles() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="page">
      <div className="head">
        <div>
          <h1>My vehicles</h1>
          <p>The gate opens for these licence plates.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setIsAddModalOpen(true)}
        >
          Add a vehicle
        </button>
      </div>

      <VehicleList refreshTrigger={refreshTrigger} />

      <AddVehicleModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdded={() => setRefreshTrigger((count) => count + 1)}
      />
    </div>
  );
}
