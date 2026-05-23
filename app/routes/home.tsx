import { useMemo, useState } from "react";
import { redirect, useLoaderData } from "react-router";
import { AppShell } from "~/components/AppShell";
import { NewNominationForm } from "~/components/NewNominationForm";
import { NominationCard } from "~/components/NominationCard";
import { nominationStatuses, nominationTypeLabel, type FeedNomination } from "~/domain/nominations";
import { getSettings } from "~/services/settings-service";
import { getCurrentUser } from "~/lib/auth/session";
import { getRepositories } from "~/repositories/drizzle/repositories";
import { voteOnNomination } from "~/services/vote-service";
import { createNomination } from "~/services/nomination-service";
import { storeNominationImage } from "~/services/media-service";

export async function loader({ request, context }: any) {
  const user = await getCurrentUser(request, context);
  const repos = getRepositories(context.cloudflare.env);
  const settings = await getSettings(context);
  const users = await repos.users.listUsers();
  const host = users.find((candidate) => candidate.xUserId === settings.hostUserId || candidate.username?.toLowerCase() === settings.hostHandle.toLowerCase()) ?? null;
  return {
    user,
    settings,
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
  const formData = await request.formData();
  if (formData.get("_intent") === "vote") {
    await voteOnNomination(context, user, formData);
    return null;
  }
  const nomination = await createNomination(context, user, formData);
  const images = formData.getAll("image").filter((image: unknown): image is File => image instanceof File && image.size > 0).slice(0, 4);
  for (const image of images) {
    await storeNominationImage(context, user, nomination.id, image, "nomination_image", new URL(request.url).origin);
  }
  return redirect("/");
}

export default function Home() {
  const { user, settings, nominations, host } = useLoaderData<typeof loader>();
  const [filters, setFilters] = useState({ status: "", type: "", search: "", sort: "newest" });
  const statusOptions = [
    { value: "", label: "All" },
    ...nominationStatuses.filter((status) => status !== "draft").map((status) => ({ value: status, label: status })),
  ];
  const typeOptions = [{ value: "", label: "All" }, ...settings.enabledNominationTypes.map((type) => ({ value: type, label: nominationTypeLabel(type) }))];
  const sortOptions = [
    { value: "newest", label: "Newest" },
    { value: "oldest", label: "Oldest" },
    { value: "a", label: "Most A" },
    { value: "b", label: "Most B" },
    { value: "u", label: "Most U" },
    { value: "total", label: "Most votes" },
    { value: "comments", label: "Most comments" },
  ];
  const filteredNominations = useMemo(
    () => {
      const search = filters.search.trim().toLowerCase();
      const searched = nominations.filter((nomination) => {
        const matchesFilters = (!filters.status || nomination.status === filters.status) && (!filters.type || nomination.type === filters.type);
        if (!matchesFilters) return false;
        if (!search) return true;
        const searchable = [
          nomination.text,
          nomination.rationale,
          nomination.targetTweetUrl,
          nomination.creatorUsername,
          nomination.creatorDisplayName,
          nomination.status,
          nominationTypeLabel(nomination.type),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchable.includes(search);
      });
      return [...searched].sort((left, right) => compareNominations(left, right, filters.sort));
    },
    [filters.search, filters.sort, filters.status, filters.type, nominations],
  );
  const hasActiveFilters = Boolean(filters.status || filters.type || filters.search || filters.sort !== "newest");
  return (
    <AppShell user={user}>
      <main className="mx-auto grid w-full max-w-[1010px] gap-9 py-[34px] pb-[70px] md:grid-cols-[minmax(180px,250px)_minmax(0,680px)]">
        <section className="self-start md:sticky md:top-5">
          {host ? (
            <a className="mb-4 grid grid-cols-[46px_minmax(0,1fr)] items-center gap-3 rounded-lg border border-[#1f242129] bg-[#fffcf49e] p-3 hover:border-[#1f24214d] hover:bg-[#fffcf4d1]" href={`https://x.com/${host.handle}`} target="_blank" rel="noreferrer">
              {host.profileImageUrl ? <img className="h-[46px] w-[46px] rounded-full bg-[#ddd4c5] object-cover" src={host.profileImageUrl} alt="" /> : <span className="inline-flex h-[46px] w-[46px] items-center justify-center rounded-full bg-[#ddd4c5] font-bold text-[#6e716b]" aria-hidden="true">{host.handle[0]?.toUpperCase()}</span>}
              <span className="block min-w-0">
                <span className="mb-0.5 block text-[0.68rem] uppercase tracking-[0.08em] text-[#6e716b]">Host Account</span>
                {host.displayName ? <strong className="block overflow-hidden text-ellipsis whitespace-nowrap text-[0.98rem]">{host.displayName}</strong> : null}
                <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[#6e716b]">@{host.handle}</span>
              </span>
            </a>
          ) : null}
          <div className="grid gap-4 rounded-lg border border-[#1f242129] bg-[#fffcf47a] p-3" aria-label="Feed filters">
            <label className="grid gap-1.5">
              <span className="text-[0.68rem] uppercase tracking-[0.08em] text-[#6e716b]">Search</span>
              <input
                className="min-h-[38px] rounded-md border border-[#1f242129] bg-white/45 px-3 py-2 outline-none focus:border-[#526f8d]"
                value={filters.search}
                onChange={(event) => {
                  const search = event.currentTarget.value;
                  setFilters((current) => ({ ...current, search }));
                }}
                placeholder="Search feed"
                type="search"
              />
            </label>
            <FilterGroup
              title="Status"
              options={statusOptions}
              activeValue={filters.status}
              onChange={(status) => setFilters((current) => ({ ...current, status }))}
              action={hasActiveFilters ? <button className="cursor-pointer border-b border-[#526f8d73] bg-transparent p-0 text-sm normal-case tracking-normal text-[#526f8d]" type="button" onClick={() => setFilters({ status: "", type: "", search: "", sort: "newest" })}>Clear filters</button> : null}
              reserveAction
            />
            <FilterGroup title="Type" options={typeOptions} activeValue={filters.type} onChange={(type) => setFilters((current) => ({ ...current, type }))} />
            <label className="grid gap-1.5">
              <span className="text-[0.68rem] uppercase tracking-[0.08em] text-[#6e716b]">Sort</span>
              <select
                className="min-h-[38px] rounded-md border border-[#1f242129] bg-white/45 px-3 py-2 outline-none focus:border-[#526f8d]"
                value={filters.sort}
                onChange={(event) => {
                  const sort = event.currentTarget.value;
                  setFilters((current) => ({ ...current, sort }));
                }}
              >
                {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>
        </section>
        <section className="grid gap-3.5">
          <NewNominationForm user={user} settings={settings} />
          <div className="flex items-center gap-3 py-1  px-6 opacity-50 " aria-hidden="true">
            <span className="h-px flex-1 bg-[#1f242129] my-4" />
          </div>
          {filteredNominations.length ? filteredNominations.map((nomination) => <NominationCard key={nomination.id} nomination={nomination} user={user} creatorSelfVoteAllowed={settings.creatorSelfVoteAllowed} />) : <p className="text-[#6e716b]">{nominations.length ? "No nominations match those filters." : "No nominations yet."}</p>}
        </section>
      </main>
    </AppShell>
  );
}

function compareNominations(left: FeedNomination, right: FeedNomination, sort: string) {
  if (sort === "oldest") return Date.parse(left.createdAt) - Date.parse(right.createdAt);
  if (sort === "a") return right.voteA - left.voteA || fallbackCompare(left, right);
  if (sort === "b") return right.voteB - left.voteB || fallbackCompare(left, right);
  if (sort === "u") return right.voteU - left.voteU || fallbackCompare(left, right);
  if (sort === "total") return right.voteA + right.voteB + right.voteU - (left.voteA + left.voteB + left.voteU) || fallbackCompare(left, right);
  if (sort === "comments") return right.voteCommentCount - left.voteCommentCount || fallbackCompare(left, right);
  return fallbackCompare(left, right);
}

function fallbackCompare(left: FeedNomination, right: FeedNomination) {
  return Date.parse(right.createdAt) - Date.parse(left.createdAt);
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
            className={`min-h-[34px] cursor-pointer rounded-md border px-2.5 py-1.5 disabled:cursor-not-allowed disabled:opacity-45 ${activeValue === option.value ? "border-[#496d58] bg-[#496d58] text-[#fffaf0]" : "border-transparent bg-white/45 text-[#1f2421] hover:border-[#1f242147]"}`}
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
