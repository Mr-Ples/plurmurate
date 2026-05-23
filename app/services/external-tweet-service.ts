import type { AppLoadContext } from "react-router";
import { getRepositories } from "~/repositories/drizzle/repositories";
import { LiveXClient } from "~/x/live-x-client";
import { getPublishingAccessToken } from "./publishing-service";
import { getSettings } from "./settings-service";

export async function fetchAndCacheExternalTweet(context: AppLoadContext, tweetId: string, url: string) {
  const env = context.cloudflare.env;
  const repos = getRepositories(env);
  const existing = await repos.externalTweets.findById(tweetId);
  if (existing?.fetchStatus === "ok") return existing;

  const settings = await getSettings(context);
  const hostUserId = settings.hostUserId || env.X_HOST_USER_ID;
  if (!hostUserId) return existing;

  const client = new LiveXClient(env.X_CLIENT_ID, env.X_CLIENT_SECRET);
  const accessToken = await getPublishingAccessToken(context, hostUserId, client);
  if (!accessToken) return existing;

  try {
    const tweet = await client.getTweetById(tweetId, accessToken);
    return repos.externalTweets.upsert({
      tweetId,
      url,
      authorUsername: tweet.authorUsername,
      authorName: tweet.authorName,
      authorProfileImageUrl: tweet.authorProfileImageUrl,
      authorId: tweet.authorId,
      textPreview: tweet.text,
      fetchStatus: "ok",
      rawJson: tweet,
    });
  } catch (error) {
    await repos.externalTweets.upsert({
      tweetId,
      url,
      fetchStatus: "failed",
      rawJson: { error: error instanceof Error ? error.message : "Unknown X fetch failure" },
    });
    return null;
  }
}
