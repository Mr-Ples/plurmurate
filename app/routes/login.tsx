import { useRef, useState } from "react";
import { useLoaderData } from "react-router";
import { AppShell } from "~/components/AppShell";
import { getCurrentUser } from "~/lib/auth/session";

export async function loader({ request, context }: any) {
  return { user: await getCurrentUser(request, context), configured: Boolean(context.cloudflare.env.X_CLIENT_ID && context.cloudflare.env.X_CLIENT_SECRET) };
}

export default function Login() {
  const { user, configured } = useLoaderData<typeof loader>();
  const [isStartingLogin, setIsStartingLogin] = useState(false);
  const loginStarted = useRef(false);

  function startLogin(event: React.MouseEvent<HTMLAnchorElement>) {
    if (loginStarted.current) {
      event.preventDefault();
      return;
    }

    loginStarted.current = true;
    setIsStartingLogin(true);
  }

  return (
    <AppShell user={user}>
      <main className="login-page">
        <h1>Sign in with X</h1>
        <p>Authentication uses live X OAuth 2.0 with PKCE. Configure `.dev.vars.staging` before using it locally.</p>
        {configured ? (
          <a
            aria-disabled={isStartingLogin}
            className={`primary-action ${isStartingLogin ? "is-disabled" : ""}`}
            href="/auth/x/start"
            onClick={startLogin}
          >
            {isStartingLogin ? "Opening X..." : "Continue with X"}
          </a>
        ) : (
          <p className="empty">X OAuth is not configured yet.</p>
        )}
      </main>
    </AppShell>
  );
}
