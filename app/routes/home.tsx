import { Form, Link, redirect, useLoaderData } from "react-router";
import { AppShell } from "~/components/AppShell";
import { NominationCard } from "~/components/NominationCard";
import { nominationStatuses, nominationTypes } from "~/domain/nominations";
import { getSettings } from "~/services/settings-service";
import { getCurrentUser } from "~/lib/auth/session";
import { getRepositories } from "~/repositories/drizzle/repositories";
import { voteOnNomination } from "~/services/vote-service";

export async function loader({ request, context }: any) {
  const user = await getCurrentUser(request, context);
  const url = new URL(request.url);
  const repos = getRepositories(context.cloudflare.env);
  const settings = await getSettings(context);
  const users = await repos.users.listUsers();
  const host = users.find((candidate) => candidate.xUserId === settings.hostUserId || candidate.username?.toLowerCase() === settings.hostHandle.toLowerCase()) ?? null;
  return {
    user,
    filters: {
      status: url.searchParams.get("status") ?? "",
      type: url.searchParams.get("type") ?? "",
    },
    host: settings.hostHandle
      ? {
          handle: settings.hostHandle.replace(/^@/, ""),
          profileImageUrl: host?.profileImageUrl ?? null,
          displayName: host?.displayName ?? null,
        }
      : null,
    nominations: await repos.nominations.listFeed({
      viewerUserId: user?.id,
      status: url.searchParams.get("status"),
      type: url.searchParams.get("type"),
    }),
  };
}

export async function action({ request, context }: any) {
  const user = await getCurrentUser(request, context);
  if (!user) throw redirect("/login");
  await voteOnNomination(context, user, await request.formData());
  return null;
}

export default function Home() {
  const { user, nominations, filters, host } = useLoaderData<typeof loader>();
  const statusOptions = [
    { value: "", label: "All" },
    ...nominationStatuses.filter((status) => status !== "draft").map((status) => ({ value: status, label: status })),
  ];
  const typeOptions = [{ value: "", label: "All" }, ...nominationTypes.map((type) => ({ value: type, label: type }))];
  return (
    <AppShell user={user}>
      <main className="feed-layout">
        <section className="feed-intro">
          {host ? (
            <a className="host-card" href={`https://x.com/${host.handle}`} target="_blank" rel="noreferrer">
              {host.profileImageUrl ? <img className="host-avatar" src={host.profileImageUrl} alt="" /> : <span className="host-avatar host-avatar-fallback" aria-hidden="true">{host.handle[0]?.toUpperCase()}</span>}
              <span>
                <span className="host-label">Host Account</span>
                {host.displayName ? <strong>{host.displayName}</strong> : null}
                <span>@{host.handle}</span>
              </span>
            </a>
          ) : null}
          <div className="filter-panel" aria-label="Feed filters">
            <FilterGroup title="Status" name="status" options={statusOptions} activeValue={filters.status} preserveName="type" preserveValue={filters.type} />
            <FilterGroup title="Type" name="type" options={typeOptions} activeValue={filters.type} preserveName="status" preserveValue={filters.status} />
            {(filters.status || filters.type) ? <Link className="clear-filters" to="/">Clear filters</Link> : null}
          </div>
        </section>
        <section className="feed">
          {nominations.length ? nominations.map((nomination) => <NominationCard key={nomination.id} nomination={nomination} user={user} />) : <p className="empty">No nominations yet.</p>}
        </section>
      </main>
    </AppShell>
  );
}

function FilterGroup({
  title,
  name,
  options,
  activeValue,
  preserveName,
  preserveValue,
}: {
  title: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  activeValue: string;
  preserveName: string;
  preserveValue: string;
}) {
  return (
    <div className="filter-group">
      <p>{title}</p>
      <div className="filter-options">
        {options.map((option) => (
          <Form key={option.value || "all"} method="get">
            {preserveValue ? <input type="hidden" name={preserveName} value={preserveValue} /> : null}
            <button className={activeValue === option.value ? "filter-chip active" : "filter-chip"} name={name} value={option.value} aria-pressed={activeValue === option.value}>
              {option.label}
            </button>
          </Form>
        ))}
      </div>
    </div>
  );
}
