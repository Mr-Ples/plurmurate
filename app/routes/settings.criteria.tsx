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
      <main className="py-[42px] pb-20">
        <h1 className="mt-0 mb-[18px] font-serif text-[clamp(2rem,5vw,4.8rem)] leading-[0.95] font-medium">Voting criteria</h1>
        <Form method="post" className="flex max-w-[720px] flex-col gap-2.5">
          <label className="grid gap-1.5">Minimum votes<input className={fieldClass} name="minimumTotalVotes" type="number" defaultValue={settings.minimumTotalVotes} /></label>
          <label className="grid gap-1.5">Positive ratio<input className={fieldClass} name="minimumPositiveRatio" type="number" step="0.01" defaultValue={settings.minimumPositiveRatio} /></label>
          <label className="grid gap-1.5">Positive margin<input className={fieldClass} name="minimumPositiveMargin" type="number" defaultValue={settings.minimumPositiveMargin} /></label>
          <label className="grid gap-1.5">Minimum voting age minutes<input className={fieldClass} name="minimumVotingAgeMinutes" type="number" defaultValue={settings.minimumVotingAgeMinutes} /></label>
          <button className={buttonClass}>Save</button>
        </Form>
      </main>
    </AppShell>
  );
}
