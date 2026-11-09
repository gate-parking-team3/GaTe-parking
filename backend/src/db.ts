import mongoose from "mongoose";
import { ParkingLotModel } from "./parks/parkingLot.model.js";
import { ParkingSpotModel } from "./parks/parkingSpot.model.js";
import { ReservationModel } from "./parks/reservation.model.js";
import { ParkingSessionModel } from "./parks/parkingSession.model.js";
import { ChargingSessionModel } from "./parks/chargingSession.model.js";
import { NotificationModel } from "./parks/notification.model.js";
import { AuditLogModel } from "./parks/auditLog.model.js";

// Export all models for use throughout the app
export const models = {
  ParkingLot: ParkingLotModel,
  ParkingSpot: ParkingSpotModel,
  Reservation: ReservationModel,
  ParkingSession: ParkingSessionModel,
  ChargingSession: ChargingSessionModel,
  Notification: NotificationModel,
  AuditLog: AuditLogModel,
};

export async function connectDb(uri: string): Promise<void> {
  await mongoose.connect(uri);
  console.log("MongoDB connected");
}
