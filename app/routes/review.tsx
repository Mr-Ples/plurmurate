import { useLoaderData } from "react-router";
import { AppShell } from "~/components/AppShell";
import { NominationCard } from "~/components/NominationCard";
import { getCurrentUser } from "~/lib/auth/session";
import { getRepositories } from "~/repositories/drizzle/repositories";
import { moderateNomination } from "~/services/nomination-service";
import { sendQualifiedNomination } from "~/services/publishing-service";

export async function loader({ request, context }: any) {
  const user = await getCurrentUser(request, context);
  const repos = getRepositories(context.cloudflare.env);
  return { user, nominations: await repos.nominations.listFeed({ viewerUserId: user?.id, reviewOnly: true }) };
}

export async function action({ request, context }: any) {
  const user = await getCurrentUser(request, context);
  if (!user) throw new Response("Unauthorized", { status: 401 });
  const form = await request.formData();
  const nominationId = String(form.get("nominationId"));
  const intent = String(form.get("_intent"));
  if (intent === "send") await sendQualifiedNomination(context, nominationId, user);
  else await moderateNomination(context, user, nominationId, intent);
  return null;
}

export default function Review() {
  const { user, nominations } = useLoaderData<typeof loader>();
  return (
    <AppShell user={user}>
      <main className="feed-layout">
        <section className="feed-intro"><h1>Publisher review</h1></section>
        <section className="feed">{nominations.map((nomination) => <NominationCard key={nomination.id} nomination={nomination} user={user} review />)}</section>
      </main>
    </AppShell>
  );
}
