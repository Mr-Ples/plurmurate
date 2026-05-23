import type { AppLoadContext } from "react-router";
import type { FeedNomination } from "~/domain/nominations";
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
  if (!hostUserId) return fetchAndCacheTweetEmbed(repos, tweetId, url, existing, "missing_host_user");

  const client = new LiveXClient(env.X_CLIENT_ID, env.X_CLIENT_SECRET);
  const accessToken = await getPublishingAccessToken(context, hostUserId, client);
  if (!accessToken) return fetchAndCacheTweetEmbed(repos, tweetId, url, existing, "missing_access_token");

  try {
    const embedHtml = await fetchTweetEmbedHtml(url);
    const tweet = await client.getTweetById(tweetId, accessToken);
    return repos.externalTweets.upsert({
      tweetId,
      url,
      authorUsername: tweet.authorUsername,
      authorName: tweet.authorName,
      authorProfileImageUrl: tweet.authorProfileImageUrl,
      authorId: tweet.authorId,
      textPreview: tweet.text,
      mediaUrls: tweet.mediaUrls,
      embedHtml,
      fetchStatus: "ok",
      rawJson: tweet,
    });
  } catch (error) {
    const embedHtml = await fetchTweetEmbedHtml(url).catch(() => null);
    if (embedHtml) {
      return repos.externalTweets.upsert({
        tweetId,
        url,
        embedHtml,
        fetchStatus: "ok",
        rawJson: { fallback: "oembed", error: error instanceof Error ? error.message : "Unknown X fetch failure" },
      });
    }
    await repos.externalTweets.upsert({
      tweetId,
      url,
      fetchStatus: "failed",
      rawJson: { error: error instanceof Error ? error.message : "Unknown X fetch failure" },
    });
    return null;
  }
}

async function fetchAndCacheTweetEmbed(
  repos: ReturnType<typeof getRepositories>,
  tweetId: string,
  url: string,
  existing: Awaited<ReturnType<ReturnType<typeof getRepositories>["externalTweets"]["findById"]>>,
  reason: string,
) {
  const embedHtml = await fetchTweetEmbedHtml(url).catch(() => null);
  if (!embedHtml) return existing;
  return repos.externalTweets.upsert({
    tweetId,
    url,
    embedHtml,
    fetchStatus: "ok",
    rawJson: { fallback: "oembed", reason },
  });
}

export async function hydrateMissingTargetTweets(context: AppLoadContext, nominations: FeedNomination[]) {
  const missingTargets = nominations
    .filter((nomination) => {
      if (!nomination.targetTweetId || !nomination.targetTweetUrl) return false;
      if (!nomination.targetTweet) return true;
      if (nomination.targetTweet.fetchStatus !== "ok") return true;
      return !nomination.targetTweet.textPreview && !nomination.targetTweet.embedHtml;
    })
    .map((nomination) => ({ tweetId: nomination.targetTweetId as string, url: nomination.targetTweetUrl as string }));
  const uniqueTargets = [...new Map(missingTargets.map((target) => [target.tweetId, target])).values()].slice(0, 8);
  if (!uniqueTargets.length) return false;

  const results = await Promise.all(uniqueTargets.map((target) => fetchAndCacheExternalTweet(context, target.tweetId, target.url)));
  return results.some(Boolean);
}

async function fetchTweetEmbedHtml(tweetUrl: string) {
  const url = new URL("https://publish.x.com/oembed");
  url.searchParams.set("url", tweetUrl);
  url.searchParams.set("omit_script", "true");
  url.searchParams.set("dnt", "true");
  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`X oEmbed ${response.status}: ${await response.text()}`);
  const data = await response.json<{ html?: string }>();
  return data.html ?? null;
}
