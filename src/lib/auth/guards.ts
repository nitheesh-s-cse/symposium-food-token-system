import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken, type SessionPayload } from "./session";

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    throw new AuthorizationError("Admin access required");
  }
  return session;
}

export async function requireScanner(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session || session.role !== "SCANNER") {
    throw new AuthorizationError("Scanner access required");
  }
  return session;
}

export class AuthorizationError extends Error {
  status = 401;
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}
