import mongoose, { Schema } from "mongoose";
import {
  normalizeEmail,
  ROLES,
  USER_STATUSES,
  type NewUser,
  type User,
  type UserStore,
} from "./user.js";

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, default: "user", required: true },
    status: {
      type: String,
      enum: USER_STATUSES,
      default: "pending",
      required: true,
    },
    // Never loaded by default, so they cannot end up in API responses.
    activationTokenHash: { type: String, select: false },
    activationExpiresAt: { type: Date, select: false },
  },
  { timestamps: true },
);

userSchema.index({ activationTokenHash: 1 }, { unique: true, sparse: true });

export const UserModel = mongoose.model("User", userSchema);

type UserDoc = InstanceType<typeof UserModel>;

function toUser(doc: UserDoc): User {
  return {
    id: doc.id as string,
    email: doc.email,
    name: doc.name,
    passwordHash: doc.passwordHash,
    role: doc.role,
    status: doc.status,
  };
}

export const mongoUserStore: UserStore = {
  async findById(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await UserModel.findById(id);
    return doc ? toUser(doc) : null;
  },
  async findByEmail(email) {
    const doc = await UserModel.findOne({ email: normalizeEmail(email) });
    return doc ? toUser(doc) : null;
  },
  async list() {
    const docs = await UserModel.find().sort({ name: 1 });
    return docs.map(toUser);
  },
  async update(id, changes) {
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await UserModel.findByIdAndUpdate(id, changes, {
      returnDocument: "after",
      runValidators: true,
    });
    return doc ? toUser(doc) : null;
  },
  async create(user: NewUser) {
    return toUser(await UserModel.create(user));
  },
  async activateByToken(tokenHash, passwordHash, now) {
    // One atomic update, so a token cannot be used twice in parallel requests.
    const doc = await UserModel.findOneAndUpdate(
      {
        activationTokenHash: tokenHash,
        activationExpiresAt: { $gt: now },
        status: "pending",
      },
      {
        $set: { status: "active", passwordHash },
        $unset: { activationTokenHash: "", activationExpiresAt: "" },
      },
      { returnDocument: "after", runValidators: true },
    );
    return doc ? toUser(doc) : null;
  },
};
