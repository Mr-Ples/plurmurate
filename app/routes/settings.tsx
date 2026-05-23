import { Link, useLoaderData } from "react-router";
import { AppShell } from "~/components/AppShell";
import { getCurrentUser } from "~/lib/auth/session";
import { getRepositories } from "~/repositories/drizzle/repositories";
import { getSettings } from "~/services/settings-service";

export async function loader({ request, context }: any) {
  const user = await getCurrentUser(request, context);
  const repos = getRepositories(context.cloudflare.env);
  return {
    user,
    settings: await getSettings(context),
    visibleNominationCount: (await repos.nominations.listFeed({ viewerUserId: user?.id })).length,
  };
}

export default function Settings() {
  const { user, settings, visibleNominationCount } = useLoaderData<typeof loader>();
  return (
    <AppShell user={user}>
      <main className="py-[42px] pb-20">
        <h1 className="mt-0 mb-[18px] font-serif text-[clamp(2rem,5vw,4.8rem)] leading-[0.95] font-medium">Settings</h1>
        <section className="mb-[22px] grid gap-1.5 rounded-lg border border-[#1f242129] bg-[#fffcf47a] p-4">
          <p className="m-0 text-[0.68rem] uppercase tracking-[0.08em] text-[#6e716b]">Account</p>
          <h2 className="m-0 text-xl font-medium">{user ? `@${user.username ?? "me"}` : "Signed out"}</h2>
          <p className="m-0 text-[#6e716b]">Roles: {user?.roles.join(", ") || "none"}</p>
          <p className="m-0 text-[#6e716b]">Visible nominations: {visibleNominationCount}</p>
        </section>
        <div className="mb-[22px] flex flex-wrap gap-3">
          <Link className="rounded-md border border-[#1f242129] bg-white/40 px-3.5 py-3" to="/settings/criteria">Voting criteria</Link>
          <Link className="rounded-md border border-[#1f242129] bg-white/40 px-3.5 py-3" to="/settings/publishing">Publishing workflow</Link>
          <Link className="rounded-md border border-[#1f242129] bg-white/40 px-3.5 py-3" to="/settings/roles">Roles</Link>
        </div>
        <pre className="overflow-auto rounded-lg border border-[#1f242129] bg-[#fffcf4ad] p-4">{JSON.stringify(settings, null, 2)}</pre>
      </main>
    </AppShell>
  );
}
