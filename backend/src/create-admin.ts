// Creates the first administrator account, or makes an existing account an active admin.
// Usage: npm run create-admin -w backend -- <email> <name> <password>
import { config } from "dotenv";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import { hashPassword } from "./auth/password.js";
import { connectDb } from "./db.js";
import { normalizeEmail } from "./users/user.js";
import { mongoUserStore } from "./users/user.model.js";

config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const [email, name, password] = process.argv.slice(2);
// bcrypt ignores everything after 72 bytes, so longer passwords are refused.
if (
  !email ||
  !name ||
  !password ||
  password.length < 8 ||
  Buffer.byteLength(password) > 72
) {
  console.error(
    "Usage: npm run create-admin -w backend -- <email> <name> <password (8+ chars, max 72 bytes)>",
  );
  process.exit(1);
}

await connectDb(
  process.env.MONGODB_URI ?? "mongodb://localhost:27017/gate-parking",
);
const existing = await mongoUserStore.findByEmail(email);
if (existing) {
  await mongoUserStore.update(existing.id, { role: "admin", status: "active" });
  console.log(
    `${existing.email} is now an active admin (name and password unchanged)`,
  );
} else {
  const created = await mongoUserStore.create({
    email: normalizeEmail(email),
    name,
    passwordHash: await hashPassword(password),
    role: "admin",
    status: "active",
  });
  console.log(`Created admin ${created.email}`);
}
await mongoose.disconnect();
