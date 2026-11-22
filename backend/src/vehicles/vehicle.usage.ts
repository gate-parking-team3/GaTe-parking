import { ParkingSessionModel } from "../parks/parkingSession.model.js";
import { ReservationModel } from "../parks/reservation.model.js";
import { mongoUserStore } from "../users/user.model.js";
import type { UserStore } from "../users/user.js";
import { VehicleModel } from "./vehicle.model.js";

// What a vehicle is tied to outside the vehicle collection: reservations, parking sessions and its owner.
export interface VehicleUsage {
  /** True while the vehicle has an upcoming or active reservation, or is parked right now. */
  isInUse(vehicleId: string, now: Date): Promise<boolean>;
  /**
   * Plates are unique across active users only (US 5). When the plate belongs to a vehicle whose owner
   * is no longer active and that vehicle is not in use, the stale vehicle is removed so the plate can be
   * registered again. Returns true when the plate is free to use.
   */
  releasePlate(licensePlate: string, now: Date): Promise<boolean>;
}

export function mongoVehicleUsage(
  users: UserStore = mongoUserStore,
): VehicleUsage {
  const isInUse = async (vehicleId: string, now: Date) => {
    const [reserved, parked] = await Promise.all([
      ReservationModel.exists({
        vehicleId,
        $or: [
          { status: "active" },
          { status: "reserved", endTime: { $gt: now } },
        ],
      }),
      ParkingSessionModel.exists({ vehicleId, exitTime: null }),
    ]);
    return reserved !== null || parked !== null;
  };

  return {
    isInUse,
    async releasePlate(licensePlate, now) {
      const holder = await VehicleModel.findOne({ licensePlate }).lean();
      if (!holder) return true;
      const owner = await users.findById(holder.userId);
      if (owner?.status === "active") return false;
      if (await isInUse(String(holder._id), now)) return false;
      await VehicleModel.deleteOne({ _id: holder._id, userId: holder.userId });
      return true;
    },
  };
}
