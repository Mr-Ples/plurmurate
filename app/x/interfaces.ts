export interface XUser {
  id: string;
  username: string;
  name: string;
  profileImageUrl?: string | null;
  followersCount?: number;
}

export interface XTweet {
  id: string;
  text: string;
  authorId?: string | null;
  authorUsername?: string | null;
  authorName?: string | null;
  authorProfileImageUrl?: string | null;
  createdAt?: string | null;
  mediaUrls?: string[];
}

export interface UploadMediaInput {
  data: ArrayBuffer;
  mimeType: string;
  accessToken: string;
}

export interface CreateTweetInput {
  text?: string | null;
  quoteTweetId?: string | null;
  replyToTweetId?: string | null;
  mediaIds?: string[];
  accessToken: string;
}

export interface RepostInput {
  hostUserId: string;
  tweetId: string;
  accessToken: string;
}

export interface XClient {
  exchangeCode(input: { code: string; codeVerifier: string; redirectUri: string }): Promise<{ accessToken: string; refreshToken?: string }>;
  refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string }>;
  getAuthenticatedUser(accessToken: string): Promise<XUser>;
  getUserById(userId: string, accessToken: string): Promise<XUser>;
  getTweetById(tweetId: string, accessToken: string): Promise<XTweet>;
  uploadMedia(input: UploadMediaInput): Promise<{ mediaId: string }>;
  createTweet(input: CreateTweetInput): Promise<{ tweetId: string; url: string }>;
  repost(input: RepostInput): Promise<{ tweetId: string }>;
}
