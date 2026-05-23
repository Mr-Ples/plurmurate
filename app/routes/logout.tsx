import { redirect } from "react-router";
import { clearSessionCookie, getSessionCookie } from "~/lib/auth/session";
import { getRepositories } from "~/repositories/drizzle/repositories";

export async function loader({ request, context }: any) {
  return logout(request, context);
}

export async function action({ request, context }: any) {
  return logout(request, context);
}

async function logout(request: Request, context: any) {
  const sessionId = getSessionCookie(request);
  if (sessionId) await getRepositories(context.cloudflare.env).sessions.delete(sessionId);
  return redirect("/", { headers: { "Set-Cookie": clearSessionCookie() } });
}
