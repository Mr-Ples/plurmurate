import { redirect, useLoaderData } from "react-router";
import { AppShell } from "~/components/AppShell";
import { getCurrentUser } from "~/lib/auth/session";

export async function loader({ request, context }: any) {
  const user = await getCurrentUser(request, context);
  if (user) throw redirect("/");
  const configured = Boolean(context.cloudflare.env.X_CLIENT_ID && context.cloudflare.env.X_CLIENT_SECRET);
  if (configured) throw redirect("/auth/x/start");
  return { user, configured };
}

export default function Login() {
  const { user, configured } = useLoaderData<typeof loader>();

  return (
    <AppShell user={user}>
      <main className="py-[42px] pb-20">
        <h1 className="mt-0 mb-[18px] font-serif text-[clamp(2rem,5vw,4.8rem)] leading-[0.95] font-medium">Sign in with X</h1>
        <p>Authentication uses live X OAuth 2.0 with PKCE. Configure `.dev.vars.staging` before using it locally.</p>
        {configured ? (
          <p className="text-[#6e716b]">Redirecting to X...</p>
        ) : (
          <p className="text-[#6e716b]">X OAuth is not configured yet.</p>
        )}
      </main>
    </AppShell>
  );
}
