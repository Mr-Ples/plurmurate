import { redirect } from "react-router";
import { sealSecret } from "~/lib/auth/crypto";
import { sessionCookie } from "~/lib/auth/session";
import { getRepositories } from "~/repositories/drizzle/repositories";
import { bootstrapUserRoles } from "~/services/role-service";
import { LiveXClient } from "~/x/live-x-client";

function oauthCookie(request: Request) {
  const cookie = request.headers.get("Cookie") ?? "";
  const value = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("plurmurate_oauth="))?.split("=")[1];
  if (!value) return null;
  const [state, verifier] = value.split(".");
  return { state, verifier };
}

export async function loader({ request, context }: any) {
  const env = context.cloudflare.env;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = oauthCookie(request);
  if (!code || !state || !cookie || cookie.state !== state) throw new Response("Invalid OAuth callback", { status: 400 });
  const client = new LiveXClient(env.X_CLIENT_ID, env.X_CLIENT_SECRET);
  const token = await client.exchangeCode({ code, codeVerifier: cookie.verifier, redirectUri: env.X_REDIRECT_URI });
  const profile = await client.getAuthenticatedUser(token.accessToken);
  const repos = getRepositories(env);
  await repos.roles.ensureSeedRoles();
  const user = await repos.users.upsertFromX({
    xUserId: profile.id,
    username: profile.username,
    displayName: profile.name,
    profileImageUrl: profile.profileImageUrl,
    followersCount: profile.followersCount ?? 0,
    accessTokenEncrypted: await sealSecret(token.accessToken, env.SESSION_SECRET),
    refreshTokenEncrypted: token.refreshToken ? await sealSecret(token.refreshToken, env.SESSION_SECRET) : null,
  });
  await bootstrapUserRoles(context, user);
  const freshUser = await repos.users.upsertFromX({ xUserId: profile.id, username: profile.username, displayName: profile.name, profileImageUrl: profile.profileImageUrl, followersCount: profile.followersCount ?? 0 });
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  const sessionId = await repos.sessions.create(freshUser.id, expiresAt);
  return redirect("/", {
    headers: [
      ["Set-Cookie", sessionCookie(sessionId, expiresAt)],
      ["Set-Cookie", "plurmurate_oauth=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0"],
    ],
  });
}
