import mongoose from "mongoose";
import { createApp } from "./app.js";
import { withLazyDb } from "./serverless.js";

// Entrypoint for Vercel (see vercel.json and docs/deployment.md). Locally and in
// Docker the server starts from server.ts instead.
if (!process.env.JWT_SECRET) {
  console.error(
    "JWT_SECRET is not set. Add it in the Vercel project settings.",
  );
}

export default withLazyDb(createApp(), async () => {
  if (mongoose.connection.readyState === 1) return;
  // Fail fast: a serverless request should not wait 30 s for a database.
  await mongoose.connect(process.env.MONGODB_URI ?? "", {
    serverSelectionTimeoutMS: 5000,
  });
});
