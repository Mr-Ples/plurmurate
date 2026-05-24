import { ArrowLeft, Repeat2 } from "lucide-react";
import { Form, Link, redirect, useLoaderData, useLocation, useNavigate } from "react-router";
import { AppShell } from "~/components/AppShell";
import { TargetTweetCard } from "~/components/TargetTweetCard";
import { nominationTypeLabel } from "~/domain/nominations";
import { getCurrentUser } from "~/lib/auth/session";
import { getRepositories } from "~/repositories/drizzle/repositories";
import { evaluatePendingNominations } from "~/services/approval-service";
import { hydrateMissingTargetTweets } from "~/services/external-tweet-service";
import { getSettings } from "~/services/settings-service";
import { voteOnNomination } from "~/services/vote-service";

const buttonClass = "cursor-pointer rounded-md border border-[#1f2421] bg-[#1f2421] px-3.5 py-2.5 text-[#fffaf0] disabled:cursor-not-allowed disabled:opacity-45";
const fieldClass = "rounded-md border border-[#1f242129] bg-white/45 px-3 py-2.5";
const voteClass = "inline-flex h-10 min-w-[62px] cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#1f242129] bg-white/45 px-3 text-sm font-medium text-[#1f2421] hover:bg-[#fffcf4] disabled:cursor-not-allowed disabled:opacity-45";
const activeVoteClass = "border-[#496d58] bg-[#496d58] text-[#fffaf0] hover:bg-[#496d58]";

export async function loader({ request, context, params }: any) {
  const user = await getCurrentUser(request, context);
  const repos = getRepositories(context.cloudflare.env);
  await evaluatePendingNominations(context);
  let nominations = await repos.nominations.listFeed({ viewerUserId: user?.id });
  let nomination = nominations.find((item) => item.id === params.id);
  if (!nomination) throw new Response("Not found", { status: 404 });
  if (await hydrateMissingTargetTweets(context, [nomination])) {
    nominations = await repos.nominations.listFeed({ viewerUserId: user?.id });
    nomination = nominations.find((item) => item.id === params.id);
    if (!nomination) throw new Response("Not found", { status: 404 });
  }
  return { user, settings: await getSettings(context), nomination, comments: await repos.votes.listComments(params.id) };
}

export async function action({ request, context, params }: any) {
  const user = await getCurrentUser(request, context);
  if (!user) throw redirect("/login");
  const formData = await request.formData();
  const intent = formData.get("_intent");
  if (intent === "vote") {
    await voteOnNomination(context, user, formData);
  }
  return redirect(`/nominations/${params.id}`);
}

export default function NominationDetail() {
  const { user, settings, nomination, comments } = useLoaderData<typeof loader>();
  const location = useLocation();
  const navigate = useNavigate();
  const isCreator = Boolean(user && nomination.creatorUserId === user.id);
  const canVote = user?.roles.some((role) => ["voter", "publisher", "host", "admin"].includes(role)) && nomination.status === "pending" && (!isCreator || settings.creatorSelfVoteAllowed);
  const from = (location.state as { from?: string } | null)?.from;
  const backTo = from?.startsWith("/") ? from : "/";
  const backClass = "inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-[#1f242129] bg-white/35 px-3 py-2 text-[#1f2421] hover:border-[#1f24214d] hover:bg-[#fffcf4d1]";
  const nominationMediaUrls = nomination.nominationMediaUrls.length
    ? nomination.nominationMediaUrls
    : nomination.nominationMediaUrl
      ? [nomination.nominationMediaUrl]
      : [];
  const targetPost = <TargetTweetCard tweet={nomination.targetTweet} fallbackUrl={nomination.targetTweetUrl} fallbackId={nomination.targetTweetId} flush />;
  const replyTargetPost = <TargetTweetCard tweet={nomination.targetTweet} fallbackUrl={nomination.targetTweetUrl} fallbackId={nomination.targetTweetId} />;
  const media = nominationMediaUrls.length ? (
    <div className={`relative my-3.5 grid overflow-hidden rounded-md border border-[#1f242129] ${nominationMediaUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
      {nominationMediaUrls.map((url, index) => (
        <img
          className={`w-full object-cover ${nominationMediaUrls.length === 3 && index === 0 ? "row-span-2 h-[340px]" : nominationMediaUrls.length === 1 ? "max-h-[420px] min-h-[170px]" : "h-[170px]"} ${index > 0 ? "border-l border-[#1f242129]" : ""} ${index > 1 ? "border-t border-[#1f242129]" : ""}`}
          src={url}
          alt=""
          key={`${url}-${index}`}
        />
      ))}
    </div>
  ) : null;
  const motivation = nomination.rationale ? (
    <div className="relative my-4 rounded-md border border-[#1f242129] bg-white/35 p-3 text-sm leading-snug text-[#526f8d]">
      <p className="m-0 text-[0.68rem] uppercase tracking-[0.08em] text-[#6e716b]">Motivation</p>
      <p className="mt-1.5 mb-0 text-[#1f2421]">{nomination.rationale}</p>
    </div>
  ) : null;
  return (
    <AppShell user={user}>
      <main className="grid gap-5 py-[42px] pb-20">
        {from ? (
          <button className={backClass} type="button" onClick={() => navigate(-1)}>
            <ArrowLeft size={17} aria-hidden="true" />
            Back
          </button>
        ) : (
          <Link className={backClass} to={backTo}>
            <ArrowLeft size={17} aria-hidden="true" />
            Back
          </Link>
        )}
        <div className="grid gap-5 md:grid-cols-[1fr_minmax(240px,340px)]">
        <div className="relative grid gap-3">
        {nomination.type === "reply" ? replyTargetPost : null}
        {nomination.type === "reply" ? <span className="pointer-events-none absolute top-[calc(50%-18px)] bottom-[calc(50%-18px)] left-8 w-px bg-[#526f8d73]" aria-hidden="true" /> : null}
        <article className={`relative overflow-hidden rounded-lg border border-[#1f242129] bg-[#fffcf4d1] p-[18px] shadow-[0_12px_30px_rgba(31,36,33,0.06)] ${nomination.type === "reply" ? "ml-auto w-[94%] md:w-[88%]" : ""}`}>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(82,111,141,0.12),transparent_50%),linear-gradient(45deg,transparent,rgba(140,91,74,0.08))]" />
          <p className="relative m-0 text-xs uppercase tracking-[0.08em] text-[#6e716b]">{nominationTypeLabel(nomination.type)} / {nomination.status}</p>
          {nomination.type === "repost" ? (
            <div className="relative mt-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-[#6e716b]"><Repeat2 size={16} aria-hidden="true" /> Repost</p>
              {targetPost}
              {motivation}
            </div>
          ) : nomination.type === "reply" ? (
            <>
              {nomination.text ? <h1 className="relative mt-4 mb-[18px] border-l-2 border-[#526f8d73] pl-4 text-[clamp(1.35rem,3vw,2.25rem)] leading-[1.18] font-medium">{nomination.text}</h1> : null}
              {media}
              {motivation}
            </>
          ) : (
            <>
              <h1 className="relative text-[clamp(1.35rem,3vw,2.25rem)] leading-[1.18] font-medium">{nomination.text ?? nomination.targetTweetUrl}</h1>
              {media}
              {motivation}
              {targetPost}
            </>
          )}
          <Form method="post" className="relative flex flex-wrap gap-2.5" title={isCreator && !settings.creatorSelfVoteAllowed ? "You cannot vote on your own nomination." : undefined}>
            <input type="hidden" name="_intent" value="vote" />
            <input type="hidden" name="nominationId" value={nomination.id} />
            <div className="flex gap-2">
              {(["A", "B", "U"] as const).map((value) => (
                <button
                  key={value}
                  className={`${voteClass} ${nomination.userVote === value ? activeVoteClass : ""}`}
                  name="value"
                  value={value}
                  disabled={!canVote}
                  type="submit"
                  title={nomination.userVote === value ? "Undo your vote" : undefined}
                  aria-pressed={nomination.userVote === value}
                >
                  <span>{value}</span>
                  <strong>{value === "A" ? nomination.voteA : value === "B" ? nomination.voteB : nomination.voteU}</strong>
                </button>
              ))}
            </div>
            <input className={fieldClass} name="comment" maxLength={400} placeholder="Optional vote comment" disabled={!canVote} />
          </Form>
        </article>
        </div>
        <section className="overflow-auto rounded-lg border border-[#1f242129] bg-[#fffcf4ad] p-4">
          <h2>Vote comments</h2>
          {comments.length ? comments.map((comment, index) => <p key={index}><strong>{comment.value}</strong> @{comment.username}: {comment.comment}</p>) : <p>No vote comments yet.</p>}
        </section>
        </div>
      </main>
    </AppShell>
  );
}
