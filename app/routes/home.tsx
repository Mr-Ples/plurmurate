import { useEffect, useMemo, useRef, useState } from "react";
import { redirect, useLoaderData } from "react-router";
import { AppShell } from "~/components/AppShell";
import { NewNominationForm } from "~/components/NewNominationForm";
import { NominationCard } from "~/components/NominationCard";
import { nominationStatuses, nominationTypeLabel, type FeedNomination } from "~/domain/nominations";
import { visibleFeedStatusesForRoles } from "~/domain/settings";
import { getSettings } from "~/services/settings-service";
import { getCurrentUser } from "~/lib/auth/session";
import { getRepositories } from "~/repositories/drizzle/repositories";
import { voteOnNomination } from "~/services/vote-service";
import { createNomination, moderateNomination } from "~/services/nomination-service";
import { assertCanUploadNominationImages, storeNominationImage } from "~/services/media-service";
import { hydrateMissingTargetTweets } from "~/services/external-tweet-service";
import { evaluateNomination } from "~/services/approval-service";
import { isXCreditsDepletedError, markNominationSentManually, sendQualifiedNomination } from "~/services/publishing-service";

export async function loader({ request, context }: any) {
  const user = await getCurrentUser(request, context);
  if (!user) {
    return {
      user,
      settings: null,
      host: null,
      nominations: [],
      publishError: null,
    };
  }

  const repos = getRepositories(context.cloudflare.env);
  const settings = await getSettings(context);
  const url = new URL(request.url);
  const users = await repos.users.listUsers();
  const host = users.find((candidate) => candidate.xUserId === settings.hostUserId || candidate.username?.toLowerCase() === settings.hostHandle.toLowerCase()) ?? null;
  const isAdmin = user?.roles.includes("admin") ?? false;
  const visibleStatuses = new Set(visibleFeedStatusesForRoles(settings, user?.roles));
  let nominations = await repos.nominations.listFeed({
    viewerUserId: user?.id,
    includeHidden: isAdmin,
  });
  nominations = nominations.filter((nomination) => visibleStatuses.has(nomination.status));
  if (await hydrateMissingTargetTweets(context, nominations)) {
    nominations = await repos.nominations.listFeed({
      viewerUserId: user?.id,
      includeHidden: isAdmin,
    });
    nominations = nominations.filter((nomination) => visibleStatuses.has(nomination.status));
  }
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
    nominations,
    publishError: url.searchParams.get("publishError"),
  };
}

export async function action({ request, context }: any) {
  const user = await getCurrentUser(request, context);
  if (!user) throw redirect("/login");
  const formData = await request.formData();
  const appOrigin = new URL(request.url).origin;
  if (formData.get("_intent") === "vote") {
    await voteOnNomination(context, user, formData, appOrigin);
    return null;
  }
  if (formData.get("_intent") === "send") {
    try {
      await sendQualifiedNomination(context, String(formData.get("nominationId")), user, String(formData.get("decisionRationale") ?? ""), appOrigin);
      return null;
    } catch (error) {
      if (isXCreditsDepletedError(error)) return redirect("/?publishError=credits");
      throw error;
    }
  }
  if (formData.get("_intent") === "sent_manually") {
    await markNominationSentManually(context, String(formData.get("nominationId")), user, String(formData.get("decisionRationale") ?? ""), String(formData.get("publishedTweetUrl") ?? ""), appOrigin);
    return null;
  }
  if (["deny", "archive"].includes(String(formData.get("_intent")))) {
    await moderateNomination(context, user, String(formData.get("nominationId")), String(formData.get("_intent")), String(formData.get("decisionRationale") ?? ""));
    return null;
  }
  const images = formData.getAll("image").filter((image: unknown): image is File => image instanceof File && image.size > 0).slice(0, 4);
  await assertCanUploadNominationImages(context, user, images.length);
  const nomination = await createNomination(context, user, formData, appOrigin);
  for (const image of images) {
    await storeNominationImage(context, user, nomination.id, image, "nomination_image", appOrigin);
  }
  await evaluateNomination(context, nomination, appOrigin);
  return redirect("/");
}

export default function Home() {
  const { user, settings, nominations, host, publishError } = useLoaderData<typeof loader>();
  if (!user || !settings) {
    return (
      <AppShell user={user}>
        <MurmurationCanvas />
        <main className="min-h-[calc(100vh-76px)]" aria-label="Murmurating flock animation">
          <span className="sr-only">Murmurating flock animation</span>
        </main>
      </AppShell>
    );
  }

  return <LoggedInHome user={user} settings={settings} nominations={nominations} host={host} publishError={publishError} />;
}

type LoggedInHomeProps = {
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
  settings: NonNullable<Awaited<ReturnType<typeof getSettings>>>;
  nominations: FeedNomination[];
  host: {
    handle: string;
    profileImageUrl: string | null;
    displayName: string | null;
  } | null;
  publishError: string | null;
};

function LoggedInHome({ user, settings, nominations, host, publishError }: LoggedInHomeProps) {
  const isAdmin = user?.roles.includes("admin") ?? false;
  const visibleStatuses = new Set(visibleFeedStatusesForRoles(settings, user?.roles));
  const [filters, setFilters] = useState({ status: "", type: "", search: "", sort: "newest" });
  const statusOptions = [
    { value: "", label: "All" },
    ...nominationStatuses.filter((status) => status !== "draft" && visibleStatuses.has(status)).map((status) => ({ value: status, label: status })),
  ];
  const typeOptions = [{ value: "", label: "All" }, ...settings.enabledNominationTypes.map((type) => ({ value: type, label: nominationTypeLabel(type) }))];
  const sortOptions = [
    { value: "newest", label: "Newest" },
    { value: "oldest", label: "Oldest" },
    ...(settings.voteDisplayMode === "up_down"
      ? [
        { value: "a", label: "Most upvotes" },
        { value: "u", label: "Most downvotes" },
      ]
      : [
        { value: "a", label: "Most A" },
        { value: "b", label: "Most B" },
        { value: "u", label: "Most U" },
      ]),
    { value: "total", label: "Most votes" },
    { value: "comments", label: "Most comments" },
  ];
  const filteredNominations = useMemo(
    () => {
      if (!isAdmin) return nominations;
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
      return [...searched].sort((left, right) => compareNominations(left, right, filters.sort, settings.voteDisplayMode));
    },
    [filters.search, filters.sort, filters.status, filters.type, isAdmin, nominations, settings.voteDisplayMode],
  );
  const hasActiveFilters = Boolean(filters.status || filters.type || filters.search || filters.sort !== "newest");
  const showSidebar = isAdmin || Boolean(host);
  return (
    <AppShell user={user}>
      <main className={`mx-auto grid w-full gap-9 py-[34px] pb-[70px] ${showSidebar ? "max-w-[1010px] md:grid-cols-[minmax(180px,250px)_minmax(0,680px)]" : "max-w-[680px]"}`}>
        {showSidebar ? (
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
        ) : null}
        <section className="grid gap-3.5">
          {publishError === "credits" ? <PublishErrorBanner /> : null}
          <NewNominationForm user={user} settings={settings} />
          <div className="flex items-center gap-3 py-1  px-6 opacity-50 " aria-hidden="true">
            <span className="h-px flex-1 bg-[#1f242129] my-4" />
          </div>
          {filteredNominations.length ? filteredNominations.map((nomination) => <NominationCard key={nomination.id} nomination={nomination} user={user} voteDisplayMode={settings.voteDisplayMode} />) : <p className="text-[#6e716b]">{isAdmin && nominations.length ? "No nominations match those filters." : "No nominations yet."}</p>}
        </section>
      </main>
    </AppShell>
  );
}

function MurmurationCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const drawingCanvas: HTMLCanvasElement = canvas;
    const drawingContext: CanvasRenderingContext2D = context;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const birdCount = 320;
    const birds = Array.from({ length: birdCount }, (_, index) => ({
      base: index / birdCount,
      depth: 0.62 + Math.random() * 0.78,
      offsetX: (Math.random() - 0.5) * 0.035,
      offsetY: (Math.random() - 0.5) * 0.07,
      phase: Math.random() * Math.PI * 2,
      wing: Math.random() * Math.PI * 2,
    }));

    let width = 0;
    let height = 0;
    let frame = 0;
    let animationFrame = 0;
    let lastRenderTime = 0;

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      drawingCanvas.width = Math.floor(width * ratio);
      drawingCanvas.height = Math.floor(height * ratio);
      drawingContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function formationPoint(kind: number, p: number, time: number, scale: number) {
      const formationTime = time * 0.62;
      if (kind === 0) {
        const a = p * Math.PI * 2;
        const r = scale * (0.25 + p * 0.94);
        return {
          x: Math.cos(a * 2.65 - formationTime * 0.9) * r,
          y: Math.sin(a * 2.65 - formationTime * 0.9) * r * 0.62,
        };
      }

      const a = p * Math.PI * 2;
      return {
        x: Math.sin(a) * scale * 1.16,
        y: Math.sin(a * 2) * scale * 0.48,
      };
    }

    function smoothstep(value: number) {
      return value * value * (3 - 2 * value);
    }

    function clamp(value: number, min: number, max: number) {
      return Math.min(max, Math.max(min, value));
    }

    function drawBird(x: number, y: number, size: number, angle: number, opacity: number) {
      const wing = Math.sin(frame * 0.1 + size + angle) * size * 0.42;
      drawingContext.save();
      drawingContext.translate(x, y);
      drawingContext.rotate(angle);
      drawingContext.globalAlpha = opacity;
      drawingContext.strokeStyle = "#1f2421";
      drawingContext.lineWidth = Math.max(0.9, size * 0.12);
      drawingContext.lineCap = "round";
      drawingContext.beginPath();
      drawingContext.moveTo(-size, wing * 0.24);
      drawingContext.quadraticCurveTo(-size * 0.26, -size * 0.62 - wing, 0, 0);
      drawingContext.quadraticCurveTo(size * 0.32, -size * 0.58 + wing, size, wing * 0.2);
      drawingContext.stroke();
      drawingContext.restore();
    }

    function render(renderTime = 0) {
      const elapsed = lastRenderTime ? renderTime - lastRenderTime : 16.67;
      lastRenderTime = renderTime;
      const frameStep = (reducedMotion ? 0.28 : 1) * Math.min(elapsed / 16.67, 2);

      drawingContext.clearRect(0, 0, width, height);

      const time = frame * 0.006 + 12.4;
      const centerX = width * (0.5 + Math.sin(time * 0.28) * 0.035);
      const centerY = height * (0.53 + Math.cos(time * 0.24) * 0.035);
      const scale = Math.min(width, height) * 0.36;
      const cycle = ((time % 16) / 16) * 2;
      const current = Math.floor(cycle) % 2;
      const next = (current + 1) % 2;
      const local = cycle - Math.floor(cycle);
      const scatterIn = smoothstep(clamp((local - 0.42) / 0.08, 0, 1));
      const scatterOut = 1 - smoothstep(clamp((local - 0.74) / 0.1, 0, 1));
      const chaos = scatterIn * scatterOut;
      const blend = smoothstep(clamp((local - 0.7) / 0.22, 0, 1));

      for (const bird of birds) {
        const p = (bird.base + Math.sin(time * 0.5 + bird.phase) * 0.004 + 1) % 1;
        const start = formationPoint(current, p, time, scale);
        const end = formationPoint(next, p, time, scale);
        const driftX = Math.sin(time * 1.1 + bird.phase) * scale * 0.02 + bird.offsetX * scale;
        const driftY = Math.cos(time * 0.95 + bird.phase) * scale * 0.02 + bird.offsetY * scale;
        const scatterAngle = bird.base * Math.PI * 6.4 + time * (0.28 + bird.depth * 0.14) + Math.sin(time * 0.72 + bird.phase) * 0.28;
        const scatterX = Math.cos(scatterAngle) * width * (0.18 + ((bird.base * 5.31) % 1) * 0.34) + Math.sin(time * 0.9 + bird.phase) * width * 0.045;
        const scatterY = Math.sin(scatterAngle * 0.82) * height * (0.16 + ((bird.base * 3.77) % 1) * 0.28) + Math.cos(time * 0.82 + bird.phase) * height * 0.04;
        const formedX = start.x * (1 - blend) + end.x * blend;
        const formedY = start.y * (1 - blend) + end.y * blend;
        const x = centerX + formedX * (1 - chaos) + scatterX * chaos + driftX;
        const y = centerY + formedY * (1 - chaos) + scatterY * chaos + driftY;

        const pNext = (p + 0.003) % 1;
        const startNext = formationPoint(current, pNext, time, scale);
        const endNext = formationPoint(next, pNext, time, scale);
        const nextScatterAngle = pNext * Math.PI * 6.4 + time * (0.28 + bird.depth * 0.14);
        const nextScatterX = Math.cos(nextScatterAngle) * width * (0.18 + ((bird.base * 5.31) % 1) * 0.34);
        const nextScatterY = Math.sin(nextScatterAngle * 0.82) * height * (0.16 + ((bird.base * 3.77) % 1) * 0.28);
        const nextFormedX = startNext.x * (1 - blend) + endNext.x * blend;
        const nextFormedY = startNext.y * (1 - blend) + endNext.y * blend;
        const nextX = centerX + nextFormedX * (1 - chaos) + nextScatterX * chaos;
        const nextY = centerY + nextFormedY * (1 - chaos) + nextScatterY * chaos;

        const size = 2.4 + bird.depth * 3.2 + Math.sin(time * (5 + chaos * 2) + bird.wing) * 0.35;
        const opacity = 0.28 + bird.depth * 0.4 - chaos * 0.06;
        drawBird(x, y, size, Math.atan2(nextY - y, nextX - x), opacity);
      }

      frame += frameStep;
        animationFrame = requestAnimationFrame(render);
      }

    resize();
      render();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0 h-screen w-screen" aria-hidden="true" />;
}

function PublishErrorBanner() {
  return (
    <div className="rounded-md border border-[#8b343466] bg-[#fff1ed] px-4 py-3 text-sm text-[#8b3434]">
      X rejected the publish request because the host account is out of API credits. Add funds or credits to the X developer account, then try again, or use Sent manually after posting it yourself.
    </div>
  );
}

function compareNominations(left: FeedNomination, right: FeedNomination, sort: string, voteDisplayMode: string) {
  if (sort === "oldest") return Date.parse(left.createdAt) - Date.parse(right.createdAt);
  if (sort === "a") {
    if (voteDisplayMode === "up_down") return right.voteA + right.voteB - (left.voteA + left.voteB) || fallbackCompare(left, right);
    return right.voteA - left.voteA || fallbackCompare(left, right);
  }
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
