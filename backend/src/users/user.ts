export const ROLES = ["user", "admin"] as const;
export type Role = (typeof ROLES)[number];
export const USER_STATUSES = ["pending", "active", "disabled"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export type User = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  status: UserStatus;
  // Same physical employee can own a separate user and admin account.
  employeeId?: string;
  // Private activation metadata. Never included in API responses.
  activationTokenHash?: string;
  activationExpiresAt?: Date;
};
export type PublicUser = Pick<User, "id" | "email" | "name" | "role" | "status"> & {
  employeeId?: string;
};
export type UserChanges = Partial<Pick<User, "role" | "status">>;
export type NewUser = Omit<User, "id">;
export interface UserStore {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  list(): Promise<User[]>;
  update(id: string, changes: UserChanges): Promise<User | null>;
  create(user: NewUser): Promise<User>;
  // Atomic compare-and-set: only unexpired, pending accounts can be activated.
  activateByToken(tokenHash: string, passwordHash: string, now: Date): Promise<User | null>;
}
export function toPublicUser(user: User): PublicUser {
  const { id, email, name, role, status } = user;
  const result: PublicUser = { id, email, name, role, status };
  if (user.employeeId !== undefined) result.employeeId = user.employeeId;
  return result;
}
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
