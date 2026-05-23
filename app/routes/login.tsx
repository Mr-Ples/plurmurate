import { useLoaderData } from "react-router";
import { AppShell } from "~/components/AppShell";
import { getCurrentUser } from "~/lib/auth/session";

export async function loader({ request, context }: any) {
  return { user: await getCurrentUser(request, context), configured: Boolean(context.cloudflare.env.X_CLIENT_ID && context.cloudflare.env.X_CLIENT_SECRET) };
}

export default function Login() {
  const { user, configured } = useLoaderData<typeof loader>();
  return (
    <AppShell user={user}>
      <main className="login-page">
        <h1>Sign in with X</h1>
        <p>Authentication uses live X OAuth 2.0 with PKCE. Configure `.env` from `.env.example` before using it locally.</p>
        {configured ? <a className="primary-action" href="/auth/x/start">Continue with X</a> : <p className="empty">X OAuth is not configured yet.</p>}
      </main>
    </AppShell>
  );
}
