import { Link, useLoaderData } from "react-router";
import { AppShell } from "~/components/AppShell";
import { getCurrentUser } from "~/lib/auth/session";
import { getSettings } from "~/services/settings-service";

export async function loader({ request, context }: any) {
  const user = await getCurrentUser(request, context);
  return { user, settings: await getSettings(context) };
}

export default function Settings() {
  const { user, settings } = useLoaderData<typeof loader>();
  return (
    <AppShell user={user}>
      <main className="settings-page">
        <h1>Settings</h1>
        <div className="settings-grid">
          <Link to="/settings/criteria">Voting criteria</Link>
          <Link to="/settings/publishing">Publishing workflow</Link>
          <Link to="/settings/roles">Roles</Link>
        </div>
        <pre>{JSON.stringify(settings, null, 2)}</pre>
      </main>
    </AppShell>
  );
}
