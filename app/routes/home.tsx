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
      <main className="grid gap-9 py-[34px] pb-[70px] md:grid-cols-[minmax(180px,280px)_1fr]">
        <section className="self-start md:sticky md:top-5">
          {host ? (
            <a className="mb-4 grid grid-cols-[46px_minmax(0,1fr)] items-center gap-3 rounded-lg border border-[#1f242129] bg-[#fffcf49e] p-3 hover:border-[#1f24214d] hover:bg-[#fffcf4d1]" href={`https://x.com/${host.handle}`} target="_blank" rel="noreferrer">
              {host.profileImageUrl ? <img className="h-[46px] w-[46px] rounded-lg bg-[#ddd4c5] object-cover" src={host.profileImageUrl} alt="" /> : <span className="inline-flex h-[46px] w-[46px] items-center justify-center rounded-lg bg-[#ddd4c5] font-bold text-[#6e716b]" aria-hidden="true">{host.handle[0]?.toUpperCase()}</span>}
              <span className="block min-w-0">
                <span className="mb-0.5 block text-[0.68rem] uppercase tracking-[0.08em] text-[#6e716b]">Host Account</span>
                {host.displayName ? <strong className="block overflow-hidden text-ellipsis whitespace-nowrap text-[0.98rem]">{host.displayName}</strong> : null}
                <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[#6e716b]">@{host.handle}</span>
              </span>
            </a>
          ) : null}
          <div className="grid gap-4 rounded-lg border border-[#1f242129] bg-[#fffcf47a] p-3" aria-label="Feed filters">
            <FilterGroup title="Status" name="status" options={statusOptions} activeValue={filters.status} preserveName="type" preserveValue={filters.type} />
            <FilterGroup title="Type" name="type" options={typeOptions} activeValue={filters.type} preserveName="status" preserveValue={filters.status} />
            {(filters.status || filters.type) ? <Link className="justify-self-start border-b border-[#526f8d73] text-sm text-[#526f8d]" to="/">Clear filters</Link> : null}
          </div>
        </section>
        <section className="grid gap-3.5">
          {nominations.length ? nominations.map((nomination) => <NominationCard key={nomination.id} nomination={nomination} user={user} />) : <p className="text-[#6e716b]">No nominations yet.</p>}
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
    <div className="grid gap-2">
      <p className="m-0 text-[0.68rem] uppercase tracking-[0.08em] text-[#6e716b]">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <Form key={option.value || "all"} method="get" className="m-0">
            {preserveValue ? <input type="hidden" name={preserveName} value={preserveValue} /> : null}
            <button className={`min-h-[34px] cursor-pointer rounded-md border px-2.5 py-1.5 capitalize disabled:cursor-not-allowed disabled:opacity-45 ${activeValue === option.value ? "border-[#496d58] bg-[#496d58] text-[#fffaf0]" : "border-transparent bg-white/45 text-[#1f2421] hover:border-[#1f242147]"}`} name={name} value={option.value} aria-pressed={activeValue === option.value}>
              {option.label}
            </button>
          </Form>
        ))}
      </div>
    </div>
  );
}
