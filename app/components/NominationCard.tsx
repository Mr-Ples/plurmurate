import { Form, Link } from "react-router";
import { nominationTypeLabel, type FeedNomination } from "~/domain/nominations";
import type { CurrentUser } from "~/repositories/interfaces";

const buttonClass = "cursor-pointer rounded-md border border-[#1f2421] bg-[#1f2421] px-3.5 py-2.5 text-[#fffaf0] disabled:cursor-not-allowed disabled:opacity-45";
const voteClass = "inline-flex min-w-[58px] cursor-pointer items-baseline justify-center gap-2 rounded-md border border-[#1f2421] bg-transparent px-3.5 py-2.5 text-[#1f2421] disabled:cursor-not-allowed disabled:opacity-45";
const activeVoteClass = "border-[#496d58] bg-[#496d58] text-[#fffaf0]";

export function NominationCard({ nomination, user, review = false }: { nomination: FeedNomination; user: CurrentUser | null; review?: boolean }) {
  const canVote = user?.roles.some((role) => ["voter", "publisher", "host", "admin"].includes(role)) && nomination.status === "pending";
  const canModerate = user?.roles.some((role) => ["publisher", "host", "admin"].includes(role));
  return (
    <article className="relative overflow-hidden rounded-lg border border-[#1f242129] bg-[#fffcf4d1] p-[18px] shadow-[0_12px_30px_rgba(31,36,33,0.06)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(82,111,141,0.12),transparent_50%),linear-gradient(45deg,transparent,rgba(140,91,74,0.08))]" />
      <div className="relative flex items-center gap-2.5">
        <img className="h-[42px] w-[42px] rounded-md bg-[#ddd4c5] object-cover" src={nomination.tweetAvatarUrl ?? nomination.creatorProfileImageUrl ?? "/favicon.ico"} alt="" />
        <div>
          <p className="m-0 text-xs uppercase tracking-[0.08em] text-[#6e716b]">{nominationTypeLabel(nomination.type)} / {nomination.status}</p>
          <p className="mt-0.5 mb-0 text-[#6e716b]">@{nomination.creatorUsername ?? "unknown"} nominated</p>
        </div>
      </div>
      {nomination.text ? <p className="relative my-[18px] font-serif text-[clamp(1.35rem,3vw,2.5rem)] leading-[1.05]">{nomination.text}</p> : null}
      {nomination.targetTweetUrl ? <a className="relative inline-block border-b border-[#526f8d73] text-[#526f8d]" href={nomination.targetTweetUrl}>Target X post {nomination.targetTweetId}</a> : null}
      {nomination.nominationMediaUrl ? <img className="relative my-3.5 block max-h-[420px] w-full rounded-md object-cover" src={nomination.nominationMediaUrl} alt="" /> : null}
      <div className="relative mt-[18px] flex items-center gap-2">
        {(["A", "B", "U"] as const).map((value) => (
          <Form method="post" action="/nominations/new" key={value} className="m-0">
            <input type="hidden" name="_intent" value="vote" />
            <input type="hidden" name="nominationId" value={nomination.id} />
            <input type="hidden" name="value" value={value} />
            <button className={`${voteClass} ${nomination.userVote === value ? activeVoteClass : ""}`} disabled={!canVote}>
              <span>{value}</span>
              <strong>{value === "A" ? nomination.voteA : value === "B" ? nomination.voteB : nomination.voteU}</strong>
            </button>
          </Form>
        ))}
        <Link className="ml-auto text-[#6e716b]" to={`/nominations/${nomination.id}`}>detail</Link>
      </div>
      {nomination.recentVoteComment ? <p className="relative text-[#6e716b]">"{nomination.recentVoteComment}"</p> : null}
      {review && canModerate ? (
        <Form method="post" className="relative mt-4 flex flex-wrap gap-2.5 border-t border-[#1f242129] pt-3.5">
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
