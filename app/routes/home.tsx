import { Form, useLoaderData } from "react-router";
import { AppShell } from "~/components/AppShell";
import { NominationCard } from "~/components/NominationCard";
import { getCurrentUser } from "~/lib/auth/session";
import { getRepositories } from "~/repositories/drizzle/repositories";
import { voteOnNomination } from "~/services/vote-service";

export async function loader({ request, context }: any) {
  const user = await getCurrentUser(request, context);
  const url = new URL(request.url);
  const repos = getRepositories(context.cloudflare.env);
  return {
    user,
    nominations: await repos.nominations.listFeed({
      viewerUserId: user?.id,
      status: url.searchParams.get("status"),
      type: url.searchParams.get("type"),
    }),
  };
}

export async function action({ request, context }: any) {
  const user = await getCurrentUser(request, context);
  if (!user) throw new Response("Unauthorized", { status: 401 });
  await voteOnNomination(context, user, await request.formData());
  return null;
}

export default function Home() {
  const { user, nominations } = useLoaderData<typeof loader>();
  return (
    <AppShell user={user}>
      <main className="feed-layout">
        <section className="feed-intro">
          <h1>Community nominations for the next post.</h1>
          <Form className="filters">
            <select name="status" aria-label="Status">
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="qualified">Qualified</option>
              <option value="sent">Sent</option>
            </select>
            <select name="type" aria-label="Type">
              <option value="">All types</option>
              <option value="original">Original</option>
              <option value="quote">Quote</option>
              <option value="repost">Repost</option>
              <option value="reply">Reply</option>
            </select>
            <button>Filter</button>
          </Form>
        </section>
        <section className="feed">
          {nominations.length ? nominations.map((nomination) => <NominationCard key={nomination.id} nomination={nomination} user={user} />) : <p className="empty">No nominations yet.</p>}
        </section>
      </main>
    </AppShell>
  );
}
