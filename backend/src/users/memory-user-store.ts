import { normalizeEmail, type User, type UserStore } from "./user.js";

// In-memory UserStore for tests. Copies the input so tests do not affect each other.
export function memoryUserStore(initial: User[] = []): UserStore {
  const users = initial.map((u) => ({ ...u }));
  return {
    async findById(id) {
      return users.find((u) => u.id === id) ?? null;
    },
    async findByEmail(email) {
      return users.find((u) => u.email === normalizeEmail(email)) ?? null;
    },
    async list() {
      return [...users];
    },
    async update(id, changes) {
      const user = users.find((u) => u.id === id);
      if (!user) return null;
      Object.assign(user, changes);
      return user;
    },
    async create(user) {
      const created = { ...user, id: String(users.length + 1) };
      users.push(created);
      return created;
    },
  };
}
