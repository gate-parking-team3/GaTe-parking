// Bootstrap a SEPARATE administrator account. Never promote an existing personal user account.
// Usage: npm run create-admin -w backend -- <admin-email> <name> <password> [employeeId]
import { config } from "dotenv";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import { hashPassword } from "./auth/password.js";
import { connectDb } from "./db.js";
import { normalizeEmail } from "./users/user.js";
import { mongoUserStore } from "./users/user.model.js";
config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });
const [email, name, password, employeeId] = process.argv.slice(2);
if (!email || !name || !password || password.length < 12 || Buffer.byteLength(password) > 72) {
  console.error("Usage: npm run create-admin -w backend -- <email> <name> <password (12+ chars, max 72 bytes)> [existing employeeId]");
  process.exit(1);
}
await connectDb(process.env.MONGODB_URI ?? "mongodb://localhost:27017/gate-parking");
try {
  const existing = await mongoUserStore.findByEmail(email);
  if (existing) {
    console.error("Email already belongs to an account; use a different admin email. Existing accounts are not promoted.");
    process.exitCode = 1;
  } else {
    const created = await mongoUserStore.create({
      email: normalizeEmail(email), name,
      passwordHash: await hashPassword(password),
      role: "admin", status: "active",
      ...(employeeId ? { employeeId } : {}),
    });
    console.log(`Created independent admin account ${created.email}`);
  }
} finally {
  await mongoose.disconnect();
}
