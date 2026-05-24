import { useEffect, useRef } from "react";
import { ExternalLink } from "lucide-react";
import type { ExternalTweetPreview } from "~/domain/external-tweets";

export function TargetTweetCard({
  tweet,
  fallbackUrl,
  fallbackId,
}: {
  tweet: ExternalTweetPreview | null;
  fallbackUrl: string | null;
  fallbackId: string | null;
  flush?: boolean;
}) {
  const url = tweet?.url ?? fallbackUrl ?? "#";
  const username = tweet?.authorUsername;
  const displayName = tweet?.authorName ?? (username ? `@${username}` : "X post");
  const avatarLabel = username?.[0]?.toUpperCase() ?? "X";
  const embedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!tweet?.embedHtml || !embedRef.current) return;
    const loadWidgets = () => {
      const twttr = (window as any).twttr;
      if (twttr?.widgets?.load) twttr.widgets.load(embedRef.current);
    };
    if ((window as any).twttr?.widgets?.load) {
      loadWidgets();
      return;
    }
    const existingScript = document.querySelector<HTMLScriptElement>("script[src='https://platform.twitter.com/widgets.js']");
    if (existingScript) {
      existingScript.addEventListener("load", loadWidgets, { once: true });
      return () => existingScript.removeEventListener("load", loadWidgets);
    }
    const script = document.createElement("script");
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    script.charset = "utf-8";
    script.onload = loadWidgets;
    document.body.appendChild(script);
  }, [tweet?.embedHtml]);

  if (!tweet && !fallbackUrl) return null;

  if (tweet?.embedHtml) {
    return (
      <div
        ref={embedRef}
        className="target-tweet-embed relative mt-3.5 max-w-full cursor-pointer overflow-hidden text-[#1f2421]"
        role="link"
        tabIndex={0}
        aria-label={`Open ${displayName} on X`}
        onClick={(event) => {
          event.stopPropagation();
          if (event.target === event.currentTarget) window.open(url, "_blank", "noopener,noreferrer");
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            window.open(url, "_blank", "noopener,noreferrer");
          }
        }}
        dangerouslySetInnerHTML={{ __html: tweet.embedHtml }}
      />
    );
  }

  return (
    <a
      className="relative mt-3.5 block rounded-lg border border-[#1f242129] bg-white/55 p-3.5 text-[#1f2421] no-underline transition hover:border-[#1f24214d] hover:bg-white/70"
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-start gap-3">
        {tweet?.authorProfileImageUrl ? (
          <img className="h-10 w-10 shrink-0 rounded-full bg-[#ddd4c5] object-cover" src={tweet.authorProfileImageUrl} alt="" />
        ) : (
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ddd4c5] text-sm font-semibold text-[#6e716b]" aria-hidden="true">{avatarLabel}</span>
        )}
        <span className="grid min-w-0 flex-1 gap-1">
          <span className="flex min-w-0 items-start justify-between gap-3">
            <span className="min-w-0">
              <strong className="block overflow-hidden text-ellipsis whitespace-nowrap text-[0.98rem]">{displayName}</strong>
              {username ? <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-sm text-[#6e716b]">@{username}</span> : null}
            </span>
            <ExternalLink className="mt-0.5 shrink-0 text-[#6e716b]" size={16} aria-hidden="true" />
          </span>
          {tweet?.textPreview ? (
            <span className="whitespace-pre-wrap text-[0.95rem] leading-snug">{tweet.textPreview}</span>
          ) : (
            <span className="text-sm text-[#6e716b]">Target X post {fallbackId}</span>
          )}
          {tweet?.mediaUrls.length ? (
            <span className={`mt-2 grid overflow-hidden rounded-md border border-[#1f242129] ${tweet.mediaUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {tweet.mediaUrls.slice(0, 4).map((url, index) => (
                <img
                  className={`w-full object-cover ${tweet.mediaUrls.length === 1 ? "max-h-[320px] min-h-[130px]" : "h-[130px]"} ${index > 0 ? "border-l border-[#1f242129]" : ""} ${index > 1 ? "border-t border-[#1f242129]" : ""}`}
                  src={url}
                  alt=""
                  key={`${url}-${index}`}
                />
              ))}
            </span>
          ) : null}
        </span>
      </div>
    </a>
  );
}
