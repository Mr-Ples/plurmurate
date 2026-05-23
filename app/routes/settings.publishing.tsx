import { Form, redirect, useLoaderData } from "react-router";
import { AppShell } from "~/components/AppShell";
import { getCurrentUser } from "~/lib/auth/session";
import { getSettings, updateSettings } from "~/services/settings-service";

const buttonClass = "cursor-pointer rounded-md border border-[#1f2421] bg-[#1f2421] px-3.5 py-2.5 text-[#fffaf0] disabled:cursor-not-allowed disabled:opacity-45";
const fieldClass = "rounded-md border border-[#1f242129] bg-white/45 px-3 py-2.5";

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
      <main className="py-[42px] pb-20">
        <h1 className="mt-0 mb-[18px] font-serif text-[clamp(2rem,5vw,4.8rem)] leading-[0.95] font-medium">Publishing</h1>
        <Form method="post" className="flex max-w-[720px] flex-col gap-2.5">
          <label className="grid gap-1.5">Workflow<select className={fieldClass} name="publishingWorkflow" defaultValue={settings.publishingWorkflow}>
            <option value="manual_review_when_qualified">Manual publisher review</option>
            <option value="auto_send_when_qualified">Automatic send when qualified</option>
          </select></label>
          <label className="grid gap-1.5">Tweet avatar mode<select className={fieldClass} name="tweetAvatarMode" defaultValue={settings.tweetAvatarMode}>
            <option value="disabled">Disabled</option>
            <option value="optional">Optional</option>
            <option value="required">Required</option>
          </select></label>
          <label className="grid gap-1.5">Host X user ID<input className={fieldClass} name="hostUserId" defaultValue={settings.hostUserId} /></label>
          <label className="grid gap-1.5">Host handle<input className={fieldClass} name="hostHandle" defaultValue={settings.hostHandle} /></label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" name="includeTweetAvatarInPublishedMedia" defaultChecked={settings.includeTweetAvatarInPublishedMedia} /> Include tweet avatar in published media</label>
          <button className={buttonClass}>Save</button>
        </Form>
      </main>
    </AppShell>
  );
}
