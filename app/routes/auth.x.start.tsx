import { redirectDocument } from "react-router";

function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function challenge(verifier: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(hash));
}

function callbackUrl(request: Request) {
  return new URL("/auth/x/callback", request.url).toString();
}

export async function loader({ request, context }: any) {
  const env = context.cloudflare.env;
  if (!env.X_CLIENT_ID || !env.X_CLIENT_SECRET) throw new Response("X OAuth is not configured", { status: 500 });
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const state = base64Url(crypto.getRandomValues(new Uint8Array(24)));
  const redirectUri = callbackUrl(request);
  const url = new URL("https://x.com/i/oauth2/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", env.X_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "users.read tweet.read tweet.write media.write offline.access follows.read");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", await challenge(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  return redirectDocument(url.toString(), {
    headers: {
      "Set-Cookie": `plurmurate_oauth=${state}.${verifier}.${encodeURIComponent(redirectUri)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=600`,
    },
  });
}
