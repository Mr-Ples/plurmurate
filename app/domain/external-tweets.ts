export interface ExternalTweetPreview {
  tweetId: string;
  url: string;
  authorUsername: string | null;
  authorName: string | null;
  authorProfileImageUrl: string | null;
  authorId: string | null;
  textPreview: string | null;
  fetchedAt: string | null;
  fetchStatus: "ok" | "failed";
}
