import { useState } from "react";
import { Info, Repeat2, ThumbsDown, ThumbsUp } from "lucide-react";
import { Form, useLocation, useNavigate } from "react-router";
import { AbuRatingDialog } from "~/components/AbuRatingDialog";
import { TargetTweetCard } from "~/components/TargetTweetCard";
import { nominationTypeLabel, type FeedNomination } from "~/domain/nominations";
import type { VoteDisplayMode } from "~/domain/settings";
import { getVoteDisplayOptions } from "~/domain/votes";
import type { CurrentUser } from "~/repositories/interfaces";

const buttonClass = "cursor-pointer rounded-md border px-3.5 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-45";
const primaryActionClass = `${buttonClass} border-[#1f2421] bg-[#1f2421] text-[#fffaf0] hover:bg-[#313834]`;
const secondaryActionClass = `${buttonClass} border-[#1f242129] bg-white/45 text-[#1f2421] hover:border-[#1f24214d] hover:bg-[#fffcf4]`;
const voteClass = "inline-flex h-9 min-w-[56px] cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#1f242129] bg-white/45 px-3 text-sm font-medium text-[#1f2421] hover:bg-[#fffcf4] disabled:cursor-not-allowed disabled:opacity-45";
const voteInfoClass = "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-[#1f242129] bg-white/45 text-[#6e716b] hover:border-[#1f24214d] hover:bg-[#fffcf4]";
const activeVoteClass = "border-[#496d58] bg-[#dbeadf] text-[#1f2421] hover:bg-[#dbeadf]";
const voteCommentClass = "h-9 min-w-[170px] flex-1 rounded-md border border-[#1f242129] bg-white/45 px-3 text-sm outline-none focus:border-[#526f8d] disabled:cursor-not-allowed disabled:opacity-45";
const decisionFieldClass = "min-h-[72px] w-full rounded-md border border-[#1f242129] bg-white/45 px-3 py-2 text-sm outline-none focus:border-[#526f8d]";
const manualUrlClass = "min-h-[38px] w-full rounded-md border border-[#1f242129] bg-white/55 px-3 py-2 text-sm outline-none focus:border-[#526f8d]";

export function NominationCard({
  nomination,
  user,
  voteDisplayMode,
}: {
  nomination: FeedNomination;
  user: CurrentUser | null;
  voteDisplayMode: VoteDisplayMode;
}) {
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
  const voteOptions = getVoteDisplayOptions(voteDisplayMode, nomination);
  const expandedPath = `/nominations/${nomination.id}`;
  const creatorProfileUrl = nomination.creatorUsername ? `https://x.com/${nomination.creatorUsername}` : null;
  const openExpandedView = () => navigate(expandedPath, { state: { from: `${location.pathname}${location.search}` } });
  const nominationMediaUrls = nomination.nominationMediaUrls.length
    ? nomination.nominationMediaUrls
    : nomination.nominationMediaUrl
      ? [nomination.nominationMediaUrl]
      : [];
  const targetPost = <TargetTweetCard tweet={nomination.targetTweet} fallbackUrl={nomination.targetTweetUrl} fallbackId={nomination.targetTweetId} flush />;
  const replyTargetPost = <TargetTweetCard tweet={nomination.targetTweet} fallbackUrl={nomination.targetTweetUrl} fallbackId={nomination.targetTweetId} />;
  const motivation = nomination.rationale ? (
    <div className="relative mt-4 rounded-md border border-[#1f242129] bg-white/35 p-3 text-sm leading-snug text-[#526f8d]">
      <p className="m-0 text-[0.68rem] uppercase tracking-[0.08em] text-[#6e716b]">Motivation</p>
      <p className="mt-1.5 mb-0 text-[#1f2421]">{nomination.rationale}</p>
    </div>
  ) : null;
  const decisionRationale = nomination.decisionRationale ? (
    <div className="relative mt-4 rounded-md border border-[#1f242129] bg-white/35 p-3 text-sm leading-snug text-[#526f8d]">
      <p className="m-0 text-[0.68rem] uppercase tracking-[0.08em] text-[#6e716b]">Host decision</p>
      <p className="mt-1.5 mb-0 text-[#1f2421]">{nomination.decisionRationale}</p>
    </div>
  ) : null;
  const publishedLink = nomination.publishedTweetUrl ? (
    <p className="relative mt-3 mb-0 text-sm">
      <a className="border-b border-[#526f8d73] text-[#526f8d]" href={nomination.publishedTweetUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
        Published post
      </a>
    </p>
  ) : null;
  const media = nominationMediaUrls.length ? (
    <div className={`relative my-3.5 grid overflow-hidden rounded-md border border-[#1f242129] ${nominationMediaUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
      {nominationMediaUrls.map((url, index) => (
        <img
          className={`w-full object-cover ${nominationMediaUrls.length === 3 && index === 0 ? "row-span-2 h-[300px]" : nominationMediaUrls.length === 1 ? "max-h-[420px] min-h-[150px]" : "h-[150px]"} ${index > 0 ? "border-l border-[#1f242129]" : ""} ${index > 1 ? "border-t border-[#1f242129]" : ""}`}
          src={url}
          alt=""
          key={`${url}-${index}`}
        />
      ))}
    </div>
  ) : null;
  const card = (
    <article
      className="relative cursor-pointer rounded-lg border border-[#1f242129] bg-[#fffcf4d1] p-[18px] shadow-[0_12px_30px_rgba(31,36,33,0.06)]"
      role="link"
      tabIndex={0}
      onClick={openExpandedView}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openExpandedView();
        }
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(82,111,141,0.12),transparent_50%),linear-gradient(45deg,transparent,rgba(140,91,74,0.08))]" />
      <div className="relative flex items-center gap-2.5">
        {creatorProfileUrl ? (
          <a href={creatorProfileUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} aria-label={`Open @${nomination.creatorUsername} on X`}>
            <img className="h-[42px] w-[42px] rounded-full bg-[#ddd4c5] object-cover" src={nomination.tweetAvatarUrl ?? nomination.creatorProfileImageUrl ?? "/favicon.ico"} alt="" />
          </a>
        ) : (
          <img className="h-[42px] w-[42px] rounded-full bg-[#ddd4c5] object-cover" src={nomination.tweetAvatarUrl ?? nomination.creatorProfileImageUrl ?? "/favicon.ico"} alt="" />
        )}
        <div>
          <p className="m-0 text-xs uppercase tracking-[0.08em] text-[#6e716b]">{nominationTypeLabel(nomination.type)} / {nomination.status}</p>
          <p className="mt-0.5 mb-0 text-[#6e716b]">
            {creatorProfileUrl ? (
              <a className="relative border-b border-[#526f8d73] text-[#526f8d]" href={creatorProfileUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                @{nomination.creatorUsername}
              </a>
            ) : (
              <span>@unknown</span>
            )}{" "}
            nominated
          </p>
        </div>
      </div>
      {nomination.type === "repost" ? (
        <div className="relative mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-[#6e716b]"><Repeat2 size={16} aria-hidden="true" /> Repost</p>
          {targetPost}
          {motivation}
        </div>
      ) : nomination.type === "reply" ? (
        <>
          {nomination.text ? <p className="relative mt-4 mb-[18px] border-l-2 pl-4 text-[clamp(1.05rem,2vw,1.45rem)] leading-[1.32]">{nomination.text}</p> : null}
          {media}
          {motivation}
        </>
      ) : (
        <>
          {nomination.text ? <p className="relative my-[18px] text-[clamp(1.05rem,2vw,1.45rem)] leading-[1.32]">{nomination.text}</p> : null}
          {media}
          {motivation}
          {targetPost}
        </>
      )}
      <Form method="post" action="/nominations/new" className="relative mt-[18px] flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
        <input type="hidden" name="_intent" value="vote" />
        <input type="hidden" name="nominationId" value={nomination.id} />
        <div className="flex gap-2">
          {voteOptions.map((option) => (
            <span className="group relative inline-flex" key={option.value}>
              <button
                className={`${voteClass} ${option.active ? activeVoteClass : ""}`}
                name="value"
                value={option.value}
                disabled={!canVote}
                type="submit"
                title={getVoteButtonTitle(voteDisplayMode, option.label, option.active, canVote)}
                aria-label={voteDisplayMode === "up_down" ? getVoteButtonLabel(option.label, option.count, option.active, canVote) : undefined}
                aria-describedby={!canVote && voteDisabledReason ? `${nomination.id}-${option.value}-vote-disabled` : undefined}
                aria-pressed={option.active}
              >
                {voteDisplayMode === "up_down" ? <VoteIcon label={option.label} size={16} /> : <span>{option.label}</span>}
                <strong>{option.count}</strong>
              </button>
              {!canVote && voteDisabledReason ? <VoteDisabledTip id={`${nomination.id}-${option.value}-vote-disabled`} text={voteDisabledReason} /> : null}
            </span>
          ))}
          {voteDisplayMode === "abu" ? (
            <button className={voteInfoClass} type="button" onClick={() => setRatingInfoOpen(true)} aria-label="Show A/B/U rating explanation">
              <Info size={16} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <input className={voteCommentClass} name="comment" maxLength={400} placeholder="Optional vote comment" disabled={!canVote} />
        {ratingInfoOpen && voteDisplayMode === "abu" ? <AbuRatingDialog onClose={() => setRatingInfoOpen(false)} /> : null}
      </Form>
      {decisionRationale}
      {publishedLink}
      {canModerate && (canSend || canDeny || canArchive) ? (
        <Form method="post" className="relative mt-4 grid gap-2.5 border-t border-[#1f242129] pt-3.5" onClick={(event) => event.stopPropagation()}>
          <input type="hidden" name="nominationId" value={nomination.id} />
          <textarea className={decisionFieldClass} name="decisionRationale" maxLength={500} defaultValue={nomination.decisionRationale ?? ""} placeholder="Host decision rationale" />
          <div className="flex flex-wrap gap-2.5">
            {canSend ? <button className={primaryActionClass} name="_intent" value="send">Send</button> : null}
            {canMarkSentManually ? (
              <>
                <button className={secondaryActionClass} type="button" onClick={() => setManualSendOpen(true)}>Sent manually</button>
                {manualSendOpen ? (
                  <div className="fixed inset-0 z-50 grid place-items-center bg-[#1f242166] p-4" role="presentation" onClick={() => setManualSendOpen(false)}>
                    <div className="grid w-full max-w-[380px] gap-3 rounded-md border border-[#1f242129] bg-[#fffcf4] p-4 shadow-[0_18px_48px_rgba(31,36,33,0.22)]" role="dialog" aria-modal="true" aria-labelledby={`${nomination.id}-manual-send-title`} onClick={(event) => event.stopPropagation()}>
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
  );
  if (nomination.type !== "reply") return card;
  return (
    <div className="relative grid gap-3">
      {replyTargetPost}
      <span className="pointer-events-none absolute top-[calc(50%-18px)] bottom-[calc(50%-18px)] left-8 w-px bg-[#526f8d73]" aria-hidden="true" />
      <div className="ml-auto w-[94%] md:w-[88%]">
        {card}
      </div>
    </div>
  );
}

function getVoteDisabledReason(user: CurrentUser | null, status: FeedNomination["status"]) {
  if (!user) return "Log in with a voting role to vote.";
  if (!user.roles.some((role) => ["voter", "admin"].includes(role))) return "Your account does not have a voting role.";
  if (status === "sent") return "Voting is closed because this nomination has been sent.";
  if (status === "withdrawn") return "Voting is closed because this nomination has been archived.";
  return null;
}

function getVoteButtonTitle(mode: VoteDisplayMode, label: string, active: boolean, canVote: boolean | undefined) {
  if (canVote && active) return "Undo your vote";
  if (mode !== "up_down") return undefined;
  return label === "Down" ? "Downvote" : "Upvote";
}

function getVoteButtonLabel(label: string, count: number, active: boolean, canVote: boolean | undefined) {
  const voteLabel = label === "Down" ? "Downvote" : "Upvote";
  if (canVote && active) return `Undo your ${voteLabel.toLowerCase()} (${count})`;
  return `${voteLabel} (${count})`;
}

function VoteIcon({ label, size }: { label: string; size: number }) {
  const Icon = label === "Down" ? ThumbsDown : ThumbsUp;
  return <Icon size={size} strokeWidth={2.1} aria-hidden="true" />;
}

function VoteDisabledTip({ id, text }: { id: string; text: string }) {
  return (
    <span id={id} role="tooltip" className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 w-[min(240px,70vw)] -translate-x-1/2 translate-y-1 rounded-md border border-[#1f242129] bg-[#1f2421] px-3 py-2 text-xs leading-snug text-[#fffaf0] opacity-0 shadow-[0_12px_30px_rgba(31,36,33,0.16)] transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
      {text}
    </span>
  );
}
