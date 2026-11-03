import { randomUUID } from "node:crypto";
import { normalizeEmail, type User, type UserStore } from "./user.js";

export function memoryUserStore(initial: User[] = []): UserStore {
  const users = initial.map((u) => ({ ...u }));
  return {
    async findById(id) { return users.find((u) => u.id === id) ?? null; },
    async findByEmail(email) { return users.find((u) => u.email === normalizeEmail(email)) ?? null; },
    async list() { return [...users]; },
    async update(id, changes) {
      const user = users.find((u) => u.id === id);
      if (!user) return null;
      Object.assign(user, changes);
      return { ...user };
    },
    async create(user) {
      if (users.some((u) => u.email === normalizeEmail(user.email))) {
        const error = new Error("Duplicate email") as Error & { code?: number };
        error.code = 11000;
        throw error;
      }
      const created = { ...user, id: randomUUID() };
      users.push(created);
      return { ...created };
    },
    async activateByToken(tokenHash, passwordHash, now) {
      const user = users.find((u) =>
        u.status === "pending" && u.activationTokenHash === tokenHash &&
        u.activationExpiresAt !== undefined && u.activationExpiresAt.getTime() > now.getTime(),
      );
      if (!user) return null;
      user.passwordHash = passwordHash;
      user.status = "active";
      delete user.activationTokenHash;
      delete user.activationExpiresAt;
      return { ...user };
    },
  };
}
