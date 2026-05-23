import { redirect } from "react-router";
import { clearSessionCookie, getSessionCookie } from "~/lib/auth/session";
import { getRepositories } from "~/repositories/drizzle/repositories";

export async function loader({ request, context }: any) {
  const sessionId = getSessionCookie(request);
  if (sessionId) await getRepositories(context.cloudflare.env).sessions.delete(sessionId);
  return redirect("/", { headers: { "Set-Cookie": clearSessionCookie() } });
}
