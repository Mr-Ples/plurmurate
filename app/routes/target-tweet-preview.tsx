import { data } from "react-router";
import { parseTweetUrl } from "~/lib/utils/tweets";
import { fetchAndCacheExternalTweet } from "~/services/external-tweet-service";

export async function loader({ request, context }: any) {
  const url = new URL(request.url);
  const parsed = parseTweetUrl(url.searchParams.get("url"));
  if (!parsed) return data({ tweet: null, error: "invalid_url" }, { status: 400 });

  const tweet = await fetchAndCacheExternalTweet(context, parsed.tweetId, parsed.url).catch(() => null);
  return data({ tweet });
}
