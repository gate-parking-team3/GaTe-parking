import VehicleList from "../components/VehicleList";

export default function Vehicles() {
  return (
    <>
      <h1 className="page-heading">My Vehicles</h1>
      <p className="page-description">
        Your registered vehicles. Choose Edit to change a vehicle's details.
      </p>
      <VehicleList />
    </>
  );
}
