import { Form, redirect, useLoaderData } from "react-router";
import { roleNames } from "~/domain/roles";
import { AppShell } from "~/components/AppShell";
import { getCurrentUser } from "~/lib/auth/session";
import { getRepositories } from "~/repositories/drizzle/repositories";
import { updateUserRole } from "~/services/role-service";

export async function loader({ request, context }: any) {
  const user = await getCurrentUser(request, context);
  const repos = getRepositories(context.cloudflare.env);
  return { user, users: await repos.users.listUsers() };
}

export async function action({ request, context }: any) {
  const actor = await getCurrentUser(request, context);
  if (!actor) throw new Response("Unauthorized", { status: 401 });
  const form = await request.formData();
  await updateUserRole(context, actor, String(form.get("userId")), String(form.get("role")) as any, form.get("enabled") === "on");
  return redirect("/settings/roles");
}

export default function RoleSettings() {
  const { user, users } = useLoaderData<typeof loader>();
  return (
    <AppShell user={user}>
      <main className="settings-page">
        <h1>Roles</h1>
        <div className="role-list">
          {users.map((account) => (
            <Form method="post" key={account.id} className="role-row">
              <input type="hidden" name="userId" value={account.id} />
              <span>@{account.username ?? account.xUserId}</span>
              <select name="role">{roleNames.map((role) => <option key={role}>{role}</option>)}</select>
              <label className="inline"><input type="checkbox" name="enabled" /> Enabled</label>
              <button>Apply</button>
              <small>{account.roles.join(", ") || "none"}</small>
            </Form>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
