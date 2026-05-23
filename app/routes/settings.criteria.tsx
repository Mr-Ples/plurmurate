import { Form, redirect, useLoaderData } from "react-router";
import { AppShell } from "~/components/AppShell";
import { getCurrentUser } from "~/lib/auth/session";
import { getSettings, updateSettings } from "~/services/settings-service";

export async function loader({ request, context }: any) {
  const user = await getCurrentUser(request, context);
  return { user, settings: await getSettings(context) };
}

export async function action({ request, context }: any) {
  const user = await getCurrentUser(request, context);
  if (!user) throw new Response("Unauthorized", { status: 401 });
  const current = await getSettings(context);
  const form = Object.fromEntries(await request.formData());
  await updateSettings(context, user, {
    ...current,
    minimumTotalVotes: Number(form.minimumTotalVotes),
    minimumPositiveRatio: Number(form.minimumPositiveRatio),
    minimumPositiveMargin: Number(form.minimumPositiveMargin),
    minimumVotingAgeMinutes: Number(form.minimumVotingAgeMinutes),
  });
  return redirect("/settings");
}

export default function CriteriaSettings() {
  const { user, settings } = useLoaderData<typeof loader>();
  return (
    <AppShell user={user}>
      <main className="form-page">
        <h1>Voting criteria</h1>
        <Form method="post" className="editor-form">
          <label>Minimum votes<input name="minimumTotalVotes" type="number" defaultValue={settings.minimumTotalVotes} /></label>
          <label>Positive ratio<input name="minimumPositiveRatio" type="number" step="0.01" defaultValue={settings.minimumPositiveRatio} /></label>
          <label>Positive margin<input name="minimumPositiveMargin" type="number" defaultValue={settings.minimumPositiveMargin} /></label>
          <label>Minimum voting age minutes<input name="minimumVotingAgeMinutes" type="number" defaultValue={settings.minimumVotingAgeMinutes} /></label>
          <button>Save</button>
        </Form>
      </main>
    </AppShell>
  );
}
