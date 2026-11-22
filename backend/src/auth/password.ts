import bcrypt from "bcryptjs";

const ROUNDS = 10;

// Compared against when the email is unknown, so both login failures take the same time.
export const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", ROUNDS);

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
