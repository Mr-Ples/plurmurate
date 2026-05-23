import type { CreateTweetInput, RepostInput, UploadMediaInput, XClient } from "./interfaces";

export class LiveXClient implements XClient {
  constructor(
    private clientId: string,
    private clientSecret: string,
  ) {}

  private async request<T>(url: string, init: RequestInit = {}) {
    const response = await fetch(url, init);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`X API ${response.status}: ${text}`);
    }
    return response.json<T>();
  }

  async exchangeCode(input: { code: string; codeVerifier: string; redirectUri: string }) {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
      client_id: this.clientId,
    });
    const token = btoa(`${this.clientId}:${this.clientSecret}`);
    const data = await this.request<{ access_token: string; refresh_token?: string }>("https://api.x.com/2/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    return { accessToken: data.access_token, refreshToken: data.refresh_token };
  }

  async refreshAccessToken(refreshToken: string) {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: this.clientId,
    });
    const token = btoa(`${this.clientId}:${this.clientSecret}`);
    const data = await this.request<{ access_token: string; refresh_token?: string }>("https://api.x.com/2/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    return { accessToken: data.access_token, refreshToken: data.refresh_token };
  }

  async getAuthenticatedUser(accessToken: string) {
    const data = await this.request<{ data: any }>(
      "https://api.x.com/2/users/me?user.fields=public_metrics,profile_image_url,verified,created_at",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return {
      id: data.data.id,
      username: data.data.username,
      name: data.data.name,
      profileImageUrl: data.data.profile_image_url,
      followersCount: data.data.public_metrics?.followers_count ?? 0,
    };
  }

  async getUserById(userId: string, accessToken: string) {
    const data = await this.request<{ data: any }>(
      `https://api.x.com/2/users/${userId}?user.fields=public_metrics,profile_image_url,verified,created_at`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return {
      id: data.data.id,
      username: data.data.username,
      name: data.data.name,
      profileImageUrl: data.data.profile_image_url,
      followersCount: data.data.public_metrics?.followers_count ?? 0,
    };
  }

  async getTweetById(tweetId: string, accessToken: string) {
    const url = new URL(`https://api.x.com/2/tweets/${tweetId}`);
    url.searchParams.set("tweet.fields", "attachments,author_id,created_at");
    url.searchParams.set("expansions", "attachments.media_keys,author_id");
    url.searchParams.set("media.fields", "preview_image_url,type,url");
    url.searchParams.set("user.fields", "profile_image_url,verified");
    const data = await this.request<{ data: any; includes?: { media?: any[]; users?: any[] } }>(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const author = data.includes?.users?.find((user) => user.id === data.data.author_id);
    const mediaKeys = data.data.attachments?.media_keys ?? [];
    const mediaUrls = mediaKeys
      .map((key: string) => data.includes?.media?.find((media) => media.media_key === key))
      .map((media: any) => media?.url ?? media?.preview_image_url)
      .filter((value: unknown): value is string => typeof value === "string" && value.length > 0);
    return {
      id: data.data.id,
      text: data.data.text,
      authorId: data.data.author_id ?? null,
      authorUsername: author?.username ?? null,
      authorName: author?.name ?? null,
      authorProfileImageUrl: author?.profile_image_url ?? null,
      createdAt: data.data.created_at ?? null,
      mediaUrls,
    };
  }

  async uploadMedia(input: UploadMediaInput) {
    const form = new FormData();
    form.append("media", new Blob([input.data], { type: input.mimeType }));
    const data = await this.request<{ data?: { id: string }; media_id_string?: string }>("https://api.x.com/2/media/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${input.accessToken}` },
      body: form,
    });
    return { mediaId: data.data?.id ?? data.media_id_string ?? "" };
  }

  async createTweet(input: CreateTweetInput) {
    const body: Record<string, unknown> = {};
    if (input.text) body.text = input.text;
    if (input.quoteTweetId) body.quote_tweet_id = input.quoteTweetId;
    if (input.replyToTweetId) body.reply = { in_reply_to_tweet_id: input.replyToTweetId };
    if (input.mediaIds?.length) body.media = { media_ids: input.mediaIds };
    const data = await this.request<{ data: { id: string } }>("https://api.x.com/2/tweets", {
      method: "POST",
      headers: { Authorization: `Bearer ${input.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { tweetId: data.data.id, url: `https://x.com/i/web/status/${data.data.id}` };
  }

  async repost(input: RepostInput) {
    const data = await this.request<{ data: { retweeted: boolean } }>(`https://api.x.com/2/users/${input.hostUserId}/retweets`, {
      method: "POST",
      headers: { Authorization: `Bearer ${input.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ tweet_id: input.tweetId }),
    });
    if (!data.data.retweeted) throw new Error("X did not confirm repost");
    return { tweetId: input.tweetId };
  }
}
