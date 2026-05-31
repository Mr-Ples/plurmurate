export function parseTweetUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    if (host !== "x.com" && host !== "twitter.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    const statusIndex = parts.findIndex((part) => part === "status");
    const id = statusIndex >= 0 ? parts[statusIndex + 1] : null;
    if (!id || !/^\d+$/.test(id)) return null;
    return { tweetId: id, username: statusIndex > 0 ? parts[statusIndex - 1] : null, url: value };
  } catch {
    return null;
  }
}

export function buildTweetIntentUrl(text: string) {
  const intentUrl = new URL("https://twitter.com/intent/tweet");
  intentUrl.searchParams.set("text", text);
  return intentUrl.toString();
}
