import { useLoaderData } from "react-router";
import { AppShell } from "~/components/AppShell";
import { getCurrentUser } from "~/lib/auth/session";
import { getRepositories } from "~/repositories/drizzle/repositories";

export async function loader({ request, context }: any) {
  const user = await getCurrentUser(request, context);
  const repos = getRepositories(context.cloudflare.env);
  return { user, nominations: await repos.nominations.listFeed({ viewerUserId: user?.id }) };
}

export default function Me() {
  const { user, nominations } = useLoaderData<typeof loader>();
  return (
    <AppShell user={user}>
      <main className="settings-page">
        <h1>{user ? `@${user.username}` : "Profile"}</h1>
        <p>Roles: {user?.roles.join(", ") ?? "none"}</p>
        <p>Visible nominations: {nominations.length}</p>
      </main>
    </AppShell>
  );
}
