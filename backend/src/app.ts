import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import { createVehicleRouter } from "./vehicles/vehicle.routes.js";

type AppOptions = { dbReady?: () => boolean };

export function createApp({
  dbReady = () => mongoose.connection.readyState === 1,
}: AppOptions = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    const db = dbReady();
    res
      .status(db ? 200 : 503)
      .json({ status: db ? "ok" : "degraded", db: db ? "up" : "down" });
  });

  app.use("/api/vehicles", createVehicleRouter());

  return app;
}
