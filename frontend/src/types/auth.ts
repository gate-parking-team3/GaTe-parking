export type Role = "user" | "admin";

export type UserStatus = "pending" | "active" | "disabled";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
}
