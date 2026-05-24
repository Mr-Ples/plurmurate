import { ArrowLeft, Info, Repeat2 } from "lucide-react";
import { useState } from "react";
import { Form, Link, redirect, useLoaderData, useLocation, useNavigate } from "react-router";
import { AbuRatingDialog } from "~/components/AbuRatingDialog";
import { AppShell } from "~/components/AppShell";
import { TargetTweetCard } from "~/components/TargetTweetCard";
import { nominationTypeLabel } from "~/domain/nominations";
import { getCurrentUser } from "~/lib/auth/session";
import { getRepositories } from "~/repositories/drizzle/repositories";
import { hydrateMissingTargetTweets } from "~/services/external-tweet-service";
import { moderateNomination } from "~/services/nomination-service";
import { isXCreditsDepletedError, markNominationSentManually, sendQualifiedNomination } from "~/services/publishing-service";
import { voteOnNomination } from "~/services/vote-service";

const buttonClass = "cursor-pointer rounded-md border px-3.5 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-45";
const primaryActionClass = `${buttonClass} border-[#1f2421] bg-[#1f2421] text-[#fffaf0] hover:bg-[#313834]`;
const secondaryActionClass = `${buttonClass} border-[#1f242129] bg-white/45 text-[#1f2421] hover:border-[#1f24214d] hover:bg-[#fffcf4]`;
const decisionFieldClass = "min-h-[92px] w-full rounded-md border border-[#1f242129] bg-white/45 px-3 py-2.5 outline-none focus:border-[#526f8d]";
const manualUrlClass = "min-h-[40px] w-full rounded-md border border-[#1f242129] bg-white/55 px-3 py-2.5 outline-none focus:border-[#526f8d]";
const voteClass = "inline-flex h-10 min-w-[62px] cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#1f242129] bg-white/45 px-3 text-sm font-medium text-[#1f2421] hover:bg-[#fffcf4] disabled:cursor-not-allowed disabled:opacity-45";
const voteInfoClass = "inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-[#1f242129] bg-white/45 text-[#6e716b] hover:border-[#1f24214d] hover:bg-[#fffcf4]";
const activeVoteClass = "border-[#496d58] bg-[#dbeadf] text-[#1f2421] hover:bg-[#dbeadf]";
const voteCommentClass = "h-10 min-w-[190px] flex-1 rounded-md border border-[#1f242129] bg-white/45 px-3 text-sm outline-none focus:border-[#526f8d] disabled:cursor-not-allowed disabled:opacity-45";

export async function loader({ request, context, params }: any) {
  const user = await getCurrentUser(request, context);
  const repos = getRepositories(context.cloudflare.env);
  const url = new URL(request.url);
  const isAdmin = user?.roles.includes("admin") ?? false;
  let nominations = await repos.nominations.listFeed({ viewerUserId: user?.id, includeHidden: isAdmin });
  let nomination = nominations.find((item) => item.id === params.id);
  if (!nomination) throw new Response("Not found", { status: 404 });
  if (await hydrateMissingTargetTweets(context, [nomination])) {
    nominations = await repos.nominations.listFeed({ viewerUserId: user?.id, includeHidden: isAdmin });
    nomination = nominations.find((item) => item.id === params.id);
    if (!nomination) throw new Response("Not found", { status: 404 });
  }
  return { user, nomination, comments: await repos.votes.listComments(params.id), publishError: url.searchParams.get("publishError") };
}

export async function action({ request, context, params }: any) {
  const user = await getCurrentUser(request, context);
  if (!user) throw redirect("/login");
  const formData = await request.formData();
  const intent = formData.get("_intent");
  if (intent === "vote") {
    await voteOnNomination(context, user, formData);
  } else if (intent === "send") {
    try {
      await sendQualifiedNomination(context, String(formData.get("nominationId")), user, String(formData.get("decisionRationale") ?? ""));
    } catch (error) {
      if (isXCreditsDepletedError(error)) return redirect(`/nominations/${params.id}?publishError=credits`);
      throw error;
    }
  } else if (intent === "sent_manually") {
    await markNominationSentManually(context, String(formData.get("nominationId")), user, String(formData.get("decisionRationale") ?? ""), String(formData.get("publishedTweetUrl") ?? ""));
  } else if (["deny", "archive"].includes(String(intent))) {
    await moderateNomination(context, user, String(formData.get("nominationId")), String(intent), String(formData.get("decisionRationale") ?? ""));
  }
  return redirect(`/nominations/${params.id}`);
}

export default function NominationDetail() {
  const { user, nomination, comments, publishError } = useLoaderData<typeof loader>();
  const location = useLocation();
  const navigate = useNavigate();
  const [manualSendOpen, setManualSendOpen] = useState(false);
  const [ratingInfoOpen, setRatingInfoOpen] = useState(false);
  const canVote = user?.roles.some((role) => ["voter", "admin"].includes(role)) && !["sent", "withdrawn"].includes(nomination.status);
  const canModerate = user?.roles.includes("admin");
  const canSend = ["qualified", "approved", "failed"].includes(nomination.status);
  const canMarkSentManually = !["sent", "withdrawn"].includes(nomination.status);
  const canDeny = ["pending", "qualified", "approved", "failed", "denied"].includes(nomination.status);
  const canArchive = !["withdrawn", "sent"].includes(nomination.status);
  const voteDisabledReason = getVoteDisabledReason(user, nomination.status);
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
  const decisionRationale = nomination.decisionRationale ? (
    <div className="relative my-4 rounded-md border border-[#1f242129] bg-white/35 p-3 text-sm leading-snug text-[#526f8d]">
      <p className="m-0 text-[0.68rem] uppercase tracking-[0.08em] text-[#6e716b]">Host decision</p>
      <p className="mt-1.5 mb-0 text-[#1f2421]">{nomination.decisionRationale}</p>
    </div>
  ) : null;
  const publishedLink = nomination.publishedTweetUrl ? (
    <p className="relative my-4 text-sm">
      <a className="border-b border-[#526f8d73] text-[#526f8d]" href={nomination.publishedTweetUrl} target="_blank" rel="noreferrer">
        Published post
      </a>
    </p>
  ) : null;
  return (
    <AppShell user={user}>
      <main className="grid gap-5 py-[42px] pb-20">
        {publishError === "credits" ? <PublishErrorBanner /> : null}
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
        <div className="relative grid gap-3">
          {nomination.type === "reply" ? replyTargetPost : null}
          {nomination.type === "reply" ? <span className="pointer-events-none absolute top-[calc(50%-18px)] bottom-[calc(50%-18px)] left-8 w-px bg-[#526f8d73]" aria-hidden="true" /> : null}
          <article className={`relative rounded-lg border border-[#1f242129] bg-[#fffcf4d1] p-[18px] shadow-[0_12px_30px_rgba(31,36,33,0.06)] ${nomination.type === "reply" ? "ml-auto w-[94%] md:w-[88%]" : ""}`}>
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
            <Form method="post" className="relative flex flex-wrap gap-2.5">
              <input type="hidden" name="_intent" value="vote" />
              <input type="hidden" name="nominationId" value={nomination.id} />
              <div className="flex gap-2">
                {(["A", "B", "U"] as const).map((value) => (
                  <span className="group relative inline-flex" key={value}>
                    <button
                      className={`${voteClass} ${nomination.userVote === value ? activeVoteClass : ""}`}
                      name="value"
                      value={value}
                      disabled={!canVote}
                      type="submit"
                      title={canVote && nomination.userVote === value ? "Undo your vote" : undefined}
                      aria-describedby={!canVote && voteDisabledReason ? `${nomination.id}-${value}-detail-vote-disabled` : undefined}
                      aria-pressed={nomination.userVote === value}
                    >
                      <span>{value}</span>
                      <strong>{value === "A" ? nomination.voteA : value === "B" ? nomination.voteB : nomination.voteU}</strong>
                    </button>
                    {!canVote && voteDisabledReason ? <VoteDisabledTip id={`${nomination.id}-${value}-detail-vote-disabled`} text={voteDisabledReason} /> : null}
                  </span>
                ))}
                <button className={voteInfoClass} type="button" onClick={() => setRatingInfoOpen(true)} aria-label="Show A/B/U rating explanation">
                  <Info size={17} aria-hidden="true" />
                </button>
              </div>
              <input className={voteCommentClass} name="comment" maxLength={400} placeholder="Optional vote comment" disabled={!canVote} />
              {ratingInfoOpen ? <AbuRatingDialog onClose={() => setRatingInfoOpen(false)} /> : null}
            </Form>
            {decisionRationale}
            {publishedLink}
            {canModerate && (canSend || canDeny || canArchive) ? (
              <Form method="post" className="relative mt-4 grid gap-2.5 border-t border-[#1f242129] pt-3.5">
                <input type="hidden" name="nominationId" value={nomination.id} />
                <textarea className={decisionFieldClass} name="decisionRationale" maxLength={500} defaultValue={nomination.decisionRationale ?? ""} placeholder="Host decision rationale" />
                <div className="flex flex-wrap gap-2.5">
                  {canSend ? <button className={primaryActionClass} name="_intent" value="send">Send</button> : null}
                  {canMarkSentManually ? (
                    <>
                      <button className={secondaryActionClass} type="button" onClick={() => setManualSendOpen(true)}>Sent manually</button>
                      {manualSendOpen ? (
                        <div className="fixed inset-0 z-50 grid place-items-center bg-[#1f242166] p-4" role="presentation" onClick={() => setManualSendOpen(false)}>
                          <div className="grid w-full max-w-[400px] gap-3 rounded-md border border-[#1f242129] bg-[#fffcf4] p-4 shadow-[0_18px_48px_rgba(31,36,33,0.22)]" role="dialog" aria-modal="true" aria-labelledby={`${nomination.id}-manual-send-title`} onClick={(event) => event.stopPropagation()}>
                            <div className="grid gap-1">
                              <h2 id={`${nomination.id}-manual-send-title`} className="m-0 text-base font-medium">Sent manually</h2>
                              <p className="m-0 text-sm text-[#6e716b]">Add the published post URL if you have it.</p>
                            </div>
                            <input className={manualUrlClass} name="publishedTweetUrl" type="url" placeholder="Published post URL (optional)" />
                            <div className="flex flex-wrap justify-end gap-2">
                              <button className={secondaryActionClass} type="button" onClick={() => setManualSendOpen(false)}>Cancel</button>
                              <button className={primaryActionClass} name="_intent" value="sent_manually">Confirm</button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                  {canDeny ? <button className={secondaryActionClass} name="_intent" value="deny">Deny</button> : null}
                  {canArchive ? <button className={secondaryActionClass} name="_intent" value="archive">Archive</button> : null}
                </div>
              </Form>
            ) : null}
          </article>
        </div>
        <section className="overflow-auto rounded-lg border border-[#1f242129] bg-[#fffcf4ad] p-4">
          {/* <h2>Vote comments</h2> */}
          {comments.length ? comments.map((comment, index) => <p key={index}><strong>{comment.value}</strong> @{comment.username}: {comment.comment}</p>) : <p>No vote comments yet.</p>}
        </section>
      </main>
    </AppShell>
  );
}

function getVoteDisabledReason(user: { roles: string[] } | null, status: string) {
  if (!user) return "Log in with a voting role to vote.";
  if (!user.roles.some((role) => ["voter", "admin"].includes(role))) return "Your account does not have a voting role.";
  if (status === "sent") return "Voting is closed because this nomination has been sent.";
  if (status === "withdrawn") return "Voting is closed because this nomination has been archived.";
  return null;
}

function VoteDisabledTip({ id, text }: { id: string; text: string }) {
  return (
    <span id={id} role="tooltip" className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 w-[min(260px,72vw)] -translate-x-1/2 translate-y-1 rounded-md border border-[#1f242129] bg-[#1f2421] px-3 py-2 text-xs leading-snug text-[#fffaf0] opacity-0 shadow-[0_12px_30px_rgba(31,36,33,0.16)] transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
      {text}
    </span>
  );
}

function PublishErrorBanner() {
  return (
    <div className="rounded-md border border-[#8b343466] bg-[#fff1ed] px-4 py-3 text-sm text-[#8b3434]">
      X rejected the publish request because the host account is out of API credits. Add funds or credits to the X developer account, then try again, or use Sent manually after posting it yourself.
    </div>
  );
}
