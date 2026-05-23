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
      <main className="py-[42px] pb-20">
        <h1 className="mt-0 mb-[18px] font-serif text-[clamp(2rem,5vw,4.8rem)] leading-[0.95] font-medium">Sign in with X</h1>
        <p>Authentication uses live X OAuth 2.0 with PKCE. Configure `.dev.vars.staging` before using it locally.</p>
        {configured ? (
          <a
            aria-disabled={isStartingLogin}
            className={`inline-block rounded-md border border-[#1f2421] bg-[#1f2421] px-3.5 py-2.5 text-[#fffaf0] ${isStartingLogin ? "pointer-events-none cursor-wait opacity-70" : "cursor-pointer"}`}
            href="/auth/x/start"
            onClick={startLogin}
          >
            {isStartingLogin ? "Opening X..." : "Continue with X"}
          </a>
        ) : (
          <p className="text-[#6e716b]">X OAuth is not configured yet.</p>
        )}
      </main>
    </AppShell>
  );
}
