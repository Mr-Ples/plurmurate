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
    publishingWorkflow: form.publishingWorkflow,
    tweetAvatarMode: form.tweetAvatarMode,
    includeTweetAvatarInPublishedMedia: form.includeTweetAvatarInPublishedMedia === "on",
    hostUserId: String(form.hostUserId ?? ""),
    hostHandle: String(form.hostHandle ?? ""),
  });
  return redirect("/settings");
}

export default function PublishingSettings() {
  const { user, settings } = useLoaderData<typeof loader>();
  return (
    <AppShell user={user}>
      <main className="form-page">
        <h1>Publishing</h1>
        <Form method="post" className="editor-form">
          <label>Workflow<select name="publishingWorkflow" defaultValue={settings.publishingWorkflow}>
            <option value="manual_review_when_qualified">Manual publisher review</option>
            <option value="auto_send_when_qualified">Automatic send when qualified</option>
          </select></label>
          <label>Tweet avatar mode<select name="tweetAvatarMode" defaultValue={settings.tweetAvatarMode}>
            <option value="disabled">Disabled</option>
            <option value="optional">Optional</option>
            <option value="required">Required</option>
          </select></label>
          <label>Host X user ID<input name="hostUserId" defaultValue={settings.hostUserId} /></label>
          <label>Host handle<input name="hostHandle" defaultValue={settings.hostHandle} /></label>
          <label className="inline"><input type="checkbox" name="includeTweetAvatarInPublishedMedia" defaultChecked={settings.includeTweetAvatarInPublishedMedia} /> Include tweet avatar in published media</label>
          <button>Save</button>
        </Form>
      </main>
    </AppShell>
  );
}
