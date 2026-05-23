import { useMemo, useState } from "react";
import { redirect, useLoaderData } from "react-router";
import { AppShell } from "~/components/AppShell";
import { NominationCard } from "~/components/NominationCard";
import { nominationStatuses, nominationTypes } from "~/domain/nominations";
import { getSettings } from "~/services/settings-service";
import { getCurrentUser } from "~/lib/auth/session";
import { getRepositories } from "~/repositories/drizzle/repositories";
import { voteOnNomination } from "~/services/vote-service";

export async function loader({ request, context }: any) {
  const user = await getCurrentUser(request, context);
  const repos = getRepositories(context.cloudflare.env);
  const settings = await getSettings(context);
  const users = await repos.users.listUsers();
  const host = users.find((candidate) => candidate.xUserId === settings.hostUserId || candidate.username?.toLowerCase() === settings.hostHandle.toLowerCase()) ?? null;
  return {
    user,
    host: settings.hostHandle
      ? {
          handle: settings.hostHandle.replace(/^@/, ""),
          profileImageUrl: host?.profileImageUrl ?? null,
          displayName: host?.displayName ?? null,
        }
      : null,
    nominations: await repos.nominations.listFeed({
      viewerUserId: user?.id,
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
  const { user, nominations, host } = useLoaderData<typeof loader>();
  const [filters, setFilters] = useState({ status: "", type: "" });
  const statusOptions = [
    { value: "", label: "All" },
    ...nominationStatuses.filter((status) => status !== "draft").map((status) => ({ value: status, label: status })),
  ];
  const typeOptions = [{ value: "", label: "All" }, ...nominationTypes.map((type) => ({ value: type, label: type }))];
  const filteredNominations = useMemo(
    () => nominations.filter((nomination) => (!filters.status || nomination.status === filters.status) && (!filters.type || nomination.type === filters.type)),
    [filters.status, filters.type, nominations],
  );
  const hasActiveFilters = Boolean(filters.status || filters.type);
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
            <FilterGroup
              title="Status"
              options={statusOptions}
              activeValue={filters.status}
              onChange={(status) => setFilters((current) => ({ ...current, status }))}
              action={hasActiveFilters ? <button className="cursor-pointer border-b border-[#526f8d73] bg-transparent p-0 text-sm normal-case tracking-normal text-[#526f8d]" type="button" onClick={() => setFilters({ status: "", type: "" })}>Clear filters</button> : null}
              reserveAction
            />
            <FilterGroup title="Type" options={typeOptions} activeValue={filters.type} onChange={(type) => setFilters((current) => ({ ...current, type }))} />
          </div>
        </section>
        <section className="grid gap-3.5">
          {filteredNominations.length ? filteredNominations.map((nomination) => <NominationCard key={nomination.id} nomination={nomination} user={user} />) : <p className="text-[#6e716b]">{nominations.length ? "No nominations match those filters." : "No nominations yet."}</p>}
        </section>
      </main>
    </AppShell>
  );
}

function FilterGroup({
  title,
  options,
  activeValue,
  onChange,
  action,
  reserveAction = false,
}: {
  title: string;
  options: Array<{ value: string; label: string }>;
  activeValue: string;
  onChange: (value: string) => void;
  action?: React.ReactNode;
  reserveAction?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="m-0 text-[0.68rem] uppercase tracking-[0.08em] text-[#6e716b]">{title}</p>
        {reserveAction ? (
          <span className="inline-flex min-h-[22px] min-w-[76px] justify-end">
            {action ?? <span className="invisible border-b text-sm normal-case tracking-normal">Clear filters</span>}
          </span>
        ) : action}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.value || "all"}
            className={`min-h-[34px] cursor-pointer rounded-md border px-2.5 py-1.5 capitalize disabled:cursor-not-allowed disabled:opacity-45 ${activeValue === option.value ? "border-[#496d58] bg-[#496d58] text-[#fffaf0]" : "border-transparent bg-white/45 text-[#1f2421] hover:border-[#1f242147]"}`}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={activeValue === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
