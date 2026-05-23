import { Form, redirect, useLoaderData } from "react-router";
import { AppShell } from "~/components/AppShell";
import { getCurrentUser } from "~/lib/auth/session";
import { createNomination } from "~/services/nomination-service";
import { getSettings } from "~/services/settings-service";
import { voteOnNomination } from "~/services/vote-service";

export async function loader({ request, context }: any) {
  const user = await getCurrentUser(request, context);
  const settings = await getSettings(context);
  return { user, settings };
}

export async function action({ request, context }: any) {
  const user = await getCurrentUser(request, context);
  if (!user) throw new Response("Unauthorized", { status: 401 });
  const formData = await request.formData();
  if (formData.get("_intent") === "vote") {
    await voteOnNomination(context, user, formData);
    return null;
  }
  const nomination = await createNomination(context, user, formData);
  return redirect(`/nominations/${nomination.id}`);
}

export default function NewNomination() {
  const { user, settings } = useLoaderData<typeof loader>();
  return (
    <AppShell user={user}>
      <main className="form-page">
        <h1>Nominate a post</h1>
        <Form method="post" encType="multipart/form-data" className="editor-form">
          <label>
            Type
            <select name="type">
              {settings.enabledNominationTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label>
            Text
            <textarea name="text" maxLength={280} rows={5} />
          </label>
          <label>
            Target X post URL
            <input name="targetTweetUrl" type="url" placeholder="https://x.com/user/status/..." />
          </label>
          <label>
            Rationale
            <textarea name="rationale" maxLength={500} rows={3} />
          </label>
          <p className="form-note">Tweet avatar mode: {settings.tweetAvatarMode}. Uploads can be attached from the nomination detail screen.</p>
          <button>Create nomination</button>
        </Form>
      </main>
    </AppShell>
  );
}
