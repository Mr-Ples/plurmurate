import { Form, Link } from "react-router";
import type { FeedNomination } from "~/domain/nominations";
import type { CurrentUser } from "~/repositories/interfaces";

export function NominationCard({ nomination, user, review = false }: { nomination: FeedNomination; user: CurrentUser | null; review?: boolean }) {
  const canVote = user?.roles.some((role) => ["voter", "publisher", "host", "admin"].includes(role)) && nomination.status === "pending";
  const canModerate = user?.roles.some((role) => ["publisher", "host", "admin"].includes(role));
  return (
    <article className={`nomination status-${nomination.status}`}>
      <div className="artifact-wash" />
      <div className="nomination-head">
        <img className="avatar" src={nomination.tweetAvatarUrl ?? nomination.creatorProfileImageUrl ?? "/favicon.ico"} alt="" />
        <div>
          <p className="eyebrow">{nomination.type} / {nomination.status}</p>
          <p className="byline">@{nomination.creatorUsername ?? "unknown"} nominated</p>
        </div>
      </div>
      {nomination.text ? <p className="nomination-text">{nomination.text}</p> : null}
      {nomination.targetTweetUrl ? <a className="target" href={nomination.targetTweetUrl}>Target X post {nomination.targetTweetId}</a> : null}
      {nomination.nominationMediaUrl ? <img className="media-preview" src={nomination.nominationMediaUrl} alt="" /> : null}
      <div className="vote-row">
        {(["A", "B", "U"] as const).map((value) => (
          <Form method="post" action="/nominations/new" key={value} className="vote-form">
            <input type="hidden" name="_intent" value="vote" />
            <input type="hidden" name="nominationId" value={nomination.id} />
            <input type="hidden" name="value" value={value} />
            <button className={nomination.userVote === value ? "vote active" : "vote"} disabled={!canVote}>
              <span>{value}</span>
              <strong>{value === "A" ? nomination.voteA : value === "B" ? nomination.voteB : nomination.voteU}</strong>
            </button>
          </Form>
        ))}
        <Link className="detail-link" to={`/nominations/${nomination.id}`}>detail</Link>
      </div>
      {nomination.recentVoteComment ? <p className="comment-excerpt">"{nomination.recentVoteComment}"</p> : null}
      {review && canModerate ? (
        <Form method="post" className="moderation">
          <input type="hidden" name="nominationId" value={nomination.id} />
          <button name="_intent" value="send">Send</button>
          <button name="_intent" value="deny">Deny</button>
          <button name="_intent" value="veto">Veto</button>
          <button name="_intent" value="archive">Archive</button>
        </Form>
      ) : null}
    </article>
  );
}
