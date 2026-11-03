import jwt from "jsonwebtoken";

const EXPIRES_IN = "8h";

export function signToken(userId: string, secret: string): string {
  return jwt.sign({}, secret, { subject: userId, expiresIn: EXPIRES_IN });
}

// Returns the user id, or null when the token is missing, expired or forged.
export function verifyToken(token: string, secret: string): string | null {
  try {
    const payload = jwt.verify(token, secret);
    return typeof payload === "object" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}
