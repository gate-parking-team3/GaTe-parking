import { useState } from "react";
import AddVehicleModal from "../components/AddVehicleModal";
import VehicleList from "../components/VehicleList";

export default function Vehicles() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="vehicles-page">
      <div className="page-header-row">
        <div>
          <h1 className="page-heading">My Vehicles</h1>
          <p className="page-description">
            The gate opens for these licence plates.
          </p>
        </div>
        <button
          type="button"
          className="btn-action-primary"
          onClick={() => setIsAddModalOpen(true)}
        >
          Add a vehicle
        </button>
      </div>

      <VehicleList refreshTrigger={refreshTrigger} />

      <AddVehicleModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdded={() => setRefreshTrigger((c) => c + 1)}
      />
    </div>
  );
}
