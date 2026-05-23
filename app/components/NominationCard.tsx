import { Form, useLocation, useNavigate } from "react-router";
import { nominationTypeLabel, type FeedNomination } from "~/domain/nominations";
import type { CurrentUser } from "~/repositories/interfaces";

const buttonClass = "cursor-pointer rounded-md border border-[#1f2421] bg-[#1f2421] px-3.5 py-2.5 text-[#fffaf0] disabled:cursor-not-allowed disabled:opacity-45";
const voteClass = "inline-flex h-9 min-w-[56px] cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#1f242129] bg-white/45 px-3 text-sm font-medium text-[#1f2421] hover:bg-[#fffcf4] disabled:cursor-not-allowed disabled:opacity-45";
const activeVoteClass = "border-[#496d58] bg-[#496d58] text-[#fffaf0] hover:bg-[#496d58]";

export function NominationCard({
  nomination,
  user,
  review = false,
  creatorSelfVoteAllowed = false,
}: {
  nomination: FeedNomination;
  user: CurrentUser | null;
  review?: boolean;
  creatorSelfVoteAllowed?: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const isCreator = Boolean(user && nomination.creatorUserId === user.id);
  const canVote = user?.roles.some((role) => ["voter", "publisher", "host", "admin"].includes(role)) && nomination.status === "pending" && (!isCreator || creatorSelfVoteAllowed);
  const canModerate = user?.roles.some((role) => ["publisher", "host", "admin"].includes(role));
  const expandedPath = `/nominations/${nomination.id}`;
  const creatorProfileUrl = nomination.creatorUsername ? `https://x.com/${nomination.creatorUsername}` : null;
  const openExpandedView = () => navigate(expandedPath, { state: { from: `${location.pathname}${location.search}` } });
  const nominationMediaUrls = nomination.nominationMediaUrls.length
    ? nomination.nominationMediaUrls
    : nomination.nominationMediaUrl
      ? [nomination.nominationMediaUrl]
      : [];
  return (
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
      {nomination.text ? <p className="relative my-[18px] text-[clamp(1.05rem,2vw,1.45rem)] leading-[1.32]">{nomination.text}</p> : null}
      {nomination.targetTweetUrl ? <span className="relative inline-block border-b border-[#526f8d73] text-[#526f8d]">Target X post {nomination.targetTweetId}</span> : null}
      {nominationMediaUrls.length ? (
        <div className={`relative my-3.5 grid overflow-hidden rounded-md border border-[#1f242129] ${nominationMediaUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {nominationMediaUrls.map((url, index) => (
            <img
              className={`h-full max-h-[420px] min-h-[150px] w-full object-cover ${nominationMediaUrls.length === 3 && index === 0 ? "row-span-2" : ""} ${index > 0 ? "border-l border-[#1f242129]" : ""} ${index > 1 ? "border-t border-[#1f242129]" : ""}`}
              src={url}
              alt=""
              key={`${url}-${index}`}
            />
          ))}
        </div>
      ) : null}
      {nomination.rationale ? (
        <div className="relative mt-4 rounded-md border border-[#1f242129] bg-white/35 p-3 text-sm leading-snug text-[#526f8d]">
          <p className="m-0 text-[0.68rem] uppercase tracking-[0.08em] text-[#6e716b]">Motivation</p>
          <p className="mt-1.5 mb-0 text-[#1f2421]">{nomination.rationale}</p>
        </div>
      ) : null}
      <div className="relative mt-[18px] flex items-center gap-2">
        {(["A", "B", "U"] as const).map((value) => (
          <Form method="post" action="/nominations/new" key={value} className="m-0" onClick={(event) => event.stopPropagation()}>
            <input type="hidden" name="_intent" value="vote" />
            <input type="hidden" name="nominationId" value={nomination.id} />
            <input type="hidden" name="value" value={value} />
            <button className={`${voteClass} ${nomination.userVote === value ? activeVoteClass : ""}`} disabled={!canVote} title={isCreator && !creatorSelfVoteAllowed ? "You cannot vote on your own nomination." : undefined}>
              <span>{value}</span>
              <strong>{value === "A" ? nomination.voteA : value === "B" ? nomination.voteB : nomination.voteU}</strong>
            </button>
          </Form>
        ))}
      </div>
      {nomination.recentVoteComment ? <p className="relative text-[#6e716b]">"{nomination.recentVoteComment}"</p> : null}
      {review && canModerate ? (
        <Form method="post" className="relative mt-4 flex flex-wrap gap-2.5 border-t border-[#1f242129] pt-3.5" onClick={(event) => event.stopPropagation()}>
          <input type="hidden" name="nominationId" value={nomination.id} />
          <button className={buttonClass} name="_intent" value="send">Send</button>
          <button className={buttonClass} name="_intent" value="deny">Deny</button>
          <button className={buttonClass} name="_intent" value="veto">Veto</button>
          <button className={buttonClass} name="_intent" value="archive">Archive</button>
        </Form>
      ) : null}
    </article>
  );
}
