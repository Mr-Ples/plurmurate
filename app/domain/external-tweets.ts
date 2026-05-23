export interface ExternalTweetPreview {
  tweetId: string;
  url: string;
  authorUsername: string | null;
  authorName: string | null;
  authorProfileImageUrl: string | null;
  authorId: string | null;
  textPreview: string | null;
  mediaUrls: string[];
  fetchedAt: string | null;
  fetchStatus: "ok" | "failed";
}
