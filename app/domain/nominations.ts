import type { ExternalTweetPreview } from "./external-tweets";

export const nominationTypes = ["original", "quote", "repost", "reply"] as const;
export const nominationStatuses = [
  "draft",
  "pending",
  "qualified",
  "approved",
  "sent",
  "denied",
  "withdrawn",
  "failed",
] as const;

export type NominationType = (typeof nominationTypes)[number];
export type NominationStatus = (typeof nominationStatuses)[number];

export function nominationTypeLabel(type: NominationType) {
  if (type === "original") return "text post";
  if (type === "quote") return "quote tweet";
  return type;
}

export interface Nomination {
  id: string;
  creatorUserId: string;
  type: NominationType;
  status: NominationStatus;
  text: string | null;
  targetTweetUrl: string | null;
  targetTweetId: string | null;
  rationale: string | null;
  tweetAvatarMediaId: string | null;
  nominationMediaId: string | null;
  publishedTweetId: string | null;
  publishedTweetUrl: string | null;
  createdAt: string;
  updatedAt: string;
  qualifiedAt: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  hiddenAt: string | null;
}

export interface FeedNomination extends Nomination {
  creatorUsername: string | null;
  creatorDisplayName: string | null;
  creatorProfileImageUrl: string | null;
  voteA: number;
  voteB: number;
  voteU: number;
  voteCommentCount: number;
  userVote: "A" | "B" | "U" | null;
  recentVoteComment: string | null;
  nominationMediaUrl: string | null;
  nominationMediaUrls: string[];
  tweetAvatarUrl: string | null;
  targetTweet: ExternalTweetPreview | null;
}
