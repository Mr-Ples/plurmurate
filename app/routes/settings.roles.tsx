import { Form, redirect, useLoaderData } from "react-router";
import { roleNames } from "~/domain/roles";
import { AppShell } from "~/components/AppShell";
import { getCurrentUser } from "~/lib/auth/session";
import { getRepositories } from "~/repositories/drizzle/repositories";
import { updateUserRole } from "~/services/role-service";

const buttonClass = "cursor-pointer rounded-md border border-[#1f2421] bg-[#1f2421] px-3.5 py-2.5 text-[#fffaf0] disabled:cursor-not-allowed disabled:opacity-45";
const fieldClass = "rounded-md border border-[#1f242129] bg-white/45 px-3 py-2.5";

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
      <main className="py-[42px] pb-20">
        <h1 className="mt-0 mb-[18px] font-serif text-[clamp(2rem,5vw,4.8rem)] leading-[0.95] font-medium">Roles</h1>
        <div className="grid gap-2.5">
          {users.map((account) => (
            <Form method="post" key={account.id} className="flex flex-wrap items-center gap-2.5 border-b border-[#1f242129] py-3">
              <input type="hidden" name="userId" value={account.id} />
              <span>@{account.username ?? account.xUserId}</span>
              <select className={fieldClass} name="role">{roleNames.map((role) => <option key={role}>{role}</option>)}</select>
              <label className="inline-flex items-center gap-2"><input type="checkbox" name="enabled" /> Enabled</label>
              <button className={buttonClass}>Apply</button>
              <small className="text-[#6e716b]">{account.roles.join(", ") || "none"}</small>
            </Form>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
