import { Repeat2 } from "lucide-react";
import { Form, useLocation, useNavigate } from "react-router";
import { TargetTweetCard } from "~/components/TargetTweetCard";
import { nominationTypeLabel, type FeedNomination } from "~/domain/nominations";
import type { CurrentUser } from "~/repositories/interfaces";

const buttonClass = "cursor-pointer rounded-md border border-[#1f2421] bg-[#1f2421] px-3.5 py-2.5 text-[#fffaf0] disabled:cursor-not-allowed disabled:opacity-45";
const voteClass = "inline-flex h-9 min-w-[56px] cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#1f242129] bg-white/45 px-3 text-sm font-medium text-[#1f2421] hover:bg-[#fffcf4] disabled:cursor-not-allowed disabled:opacity-45";
const activeVoteClass = "border-[#496d58] bg-[#496d58] text-[#fffaf0] hover:bg-[#496d58]";
const decisionFieldClass = "min-h-[72px] w-full rounded-md border border-[#1f242129] bg-white/45 px-3 py-2 text-sm outline-none focus:border-[#526f8d]";

export function NominationCard({
  nomination,
  user,
}: {
  nomination: FeedNomination;
  user: CurrentUser | null;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const canVote = user?.roles.some((role) => ["voter", "publisher", "host", "admin"].includes(role)) && !["sent", "withdrawn"].includes(nomination.status);
  const canModerate = user?.roles.some((role) => ["publisher", "host", "admin"].includes(role));
  const canSend = ["qualified", "approved", "failed"].includes(nomination.status);
  const canDeny = ["pending", "qualified", "approved", "failed", "denied"].includes(nomination.status);
  const canArchive = !["withdrawn", "sent"].includes(nomination.status);
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
      className="relative cursor-pointer overflow-hidden rounded-lg border border-[#1f242129] bg-[#fffcf4d1] p-[18px] shadow-[0_12px_30px_rgba(31,36,33,0.06)]"
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
      <div className="relative mt-[18px] flex items-center gap-2">
        {(["A", "B", "U"] as const).map((value) => (
          <Form method="post" action="/nominations/new" key={value} className="m-0" onClick={(event) => event.stopPropagation()}>
            <input type="hidden" name="_intent" value="vote" />
            <input type="hidden" name="nominationId" value={nomination.id} />
            <input type="hidden" name="value" value={value} />
            <button
              className={`${voteClass} ${nomination.userVote === value ? activeVoteClass : ""}`}
              disabled={!canVote}
              title={nomination.userVote === value ? "Undo your vote" : undefined}
              aria-pressed={nomination.userVote === value}
            >
              <span>{value}</span>
              <strong>{value === "A" ? nomination.voteA : value === "B" ? nomination.voteB : nomination.voteU}</strong>
            </button>
          </Form>
        ))}
      </div>
      {nomination.recentVoteComment ? <p className="relative text-[#6e716b]">"{nomination.recentVoteComment}"</p> : null}
      {decisionRationale}
      {canModerate && (canSend || canDeny || canArchive) ? (
        <Form method="post" className="relative mt-4 grid gap-2.5 border-t border-[#1f242129] pt-3.5" onClick={(event) => event.stopPropagation()}>
          <input type="hidden" name="nominationId" value={nomination.id} />
          <textarea className={decisionFieldClass} name="decisionRationale" maxLength={500} defaultValue={nomination.decisionRationale ?? ""} placeholder="Host decision rationale" />
          <div className="flex flex-wrap gap-2.5">
            {canSend ? <button className={buttonClass} name="_intent" value="send">Send</button> : null}
            {canDeny ? <button className={buttonClass} name="_intent" value="deny">Deny</button> : null}
            {canArchive ? <button className={buttonClass} name="_intent" value="archive">Archive</button> : null}
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
