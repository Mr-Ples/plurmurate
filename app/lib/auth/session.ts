import type { AppLoadContext } from "react-router";
import { getRepositories } from "~/repositories/drizzle/repositories";

const cookieName = "plurmurate_session";

export function getSessionCookie(request: Request) {
  const cookie = request.headers.get("Cookie") ?? "";
  return cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.split("=")[1] ?? null;
}

export function sessionCookie(id: string, expiresAt: Date) {
  return `${cookieName}=${id}; Path=/; HttpOnly; SameSite=Lax; Secure; Expires=${expiresAt.toUTCString()}`;
}

export function clearSessionCookie() {
  return `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`;
}

export async function getCurrentUser(request: Request, context: AppLoadContext) {
  const sessionId = getSessionCookie(request);
  if (!sessionId) return null;
  const repos = getRepositories(context.cloudflare.env);
  return repos.sessions.findUserBySessionId(sessionId);
}
