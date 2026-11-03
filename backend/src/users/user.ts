export const ROLES = ["user", "admin"] as const;
export type Role = (typeof ROLES)[number];

// pending: registered, waiting for approval; active: may sign in; disabled: access revoked.
export const USER_STATUSES = ["pending", "active", "disabled"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export type User = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  status: UserStatus;
};

export type PublicUser = Omit<User, "passwordHash">;

export type UserChanges = Partial<Pick<User, "role" | "status">>;

export type NewUser = Omit<User, "id">;

// Storage boundary, so routes can be tested without MongoDB.
export interface UserStore {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  list(): Promise<User[]>;
  update(id: string, changes: UserChanges): Promise<User | null>;
  create(user: NewUser): Promise<User>;
}

export function toPublicUser(user: User): PublicUser {
  const { id, email, name, role, status } = user;
  return { id, email, name, role, status };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
