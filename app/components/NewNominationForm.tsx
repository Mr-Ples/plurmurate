import { Image, Info } from "lucide-react";
import { useRef, useState } from "react";
import { Form, Link } from "react-router";
import type { NominationType } from "~/domain/nominations";
import type { AppSettings } from "~/domain/settings";
import type { CurrentUser } from "~/repositories/interfaces";

const buttonClass = "cursor-pointer rounded-md border border-[#1f2421] bg-[#1f2421] px-3.5 py-2.5 text-[#fffaf0] disabled:cursor-not-allowed disabled:opacity-45";
const fieldClass = "rounded-md border border-[#1f242129] bg-white/45 px-3 py-2.5";
const iconButtonClass = "inline-flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-md border border-[#1f242129] text-[#526f8d]";
const srOnlyClass = "absolute -m-px h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]";

export function NewNominationForm({ user, settings }: { user: CurrentUser | null; settings: AppSettings }) {
  const [selectedType, setSelectedType] = useState<NominationType>(settings.enabledNominationTypes[0] ?? "original");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const highlightRef = useRef<HTMLDivElement>(null);
  const limit = 280;
  const count = text.length;
  const overLimit = count > limit;
  const progress = Math.min(count / limit, 1);
  const remaining = limit - count;
  const needsTargetUrl = selectedType === "quote" || selectedType === "repost" || selectedType === "reply";
  const isRepost = selectedType === "repost";

  return (
    <Form id="new-post" method="post" encType="multipart/form-data" className="flex flex-col gap-2.5">
      <input type="hidden" name="_intent" value="create" />
      <section className={`grid grid-cols-[40px_minmax(0,1fr)] gap-3 rounded-lg border border-[#1f242129] bg-[#fffcf4d1] p-3 md:grid-cols-[52px_minmax(0,1fr)] md:gap-3.5 md:p-4 ${isRepost ? "pointer-events-none opacity-50" : ""}`}>
        {user?.profileImageUrl ? (
          <img className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ddd4c5] object-cover md:h-12 md:w-12" src={user.profileImageUrl} alt="" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#1f242129] bg-[#ddd4c5] font-semibold text-[#6e716b] md:h-12 md:w-12" aria-hidden="true">?</div>
        )}
        <div className="min-w-0">
          <label className={srOnlyClass} htmlFor="nomination-text">Post text</label>
          <div className="relative h-[138px] overflow-hidden">
            {text ? (
              <div className="pointer-events-none absolute inset-0 h-[138px] w-full overflow-hidden whitespace-pre-wrap break-words bg-transparent p-0 text-[1.35rem] leading-[1.35] text-[#1f2421]" aria-hidden="true" ref={highlightRef}>
                <span>{text.slice(0, limit)}</span>
                {overLimit ? <mark className="bg-red-500/20 text-[#9f1d1d]">{text.slice(limit)}</mark> : null}
              </div>
            ) : null}
            <textarea
              id="nomination-text"
              name="text"
              rows={5}
              placeholder="What's happening?"
              value={text}
              disabled={isRepost}
              required={!isRepost}
              onChange={(event) => setText(event.currentTarget.value)}
              onScroll={(event) => {
                if (highlightRef.current) highlightRef.current.scrollTop = event.currentTarget.scrollTop;
              }}
              className={`relative z-10 h-[138px] w-full resize-none overflow-y-auto border-0 bg-transparent p-0 text-[1.35rem] leading-[1.35] break-words whitespace-pre-wrap outline-none ${text ? "text-transparent caret-[#1f2421]" : "text-[#1f2421]"}`}
            />
          </div>
          <div className="flex items-center gap-2.5 border-t border-[#1f242129] pt-3">
            {user && !isRepost ? (
              <label className={iconButtonClass} title={fileName || "Add media"}>
                <Image size={19} aria-hidden="true" />
                <span className={srOnlyClass}>Add media</span>
                <input
                  className="hidden"
                  name="image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => setFileName(event.currentTarget.files?.[0]?.name ?? "")}
                />
              </label>
            ) : !user ? (
              <Link className={iconButtonClass} to="/login" title="Login to add media">
                <Image size={19} aria-hidden="true" />
                <span className={srOnlyClass}>Login to add media</span>
              </Link>
            ) : (
              <span className={`${iconButtonClass} cursor-not-allowed opacity-55`} title="Reposts cannot include media">
                <Image size={19} aria-hidden="true" />
                <span className={srOnlyClass}>Reposts cannot include media</span>
              </span>
            )}
            {fileName ? <span className="max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap text-sm text-[#6e716b] md:max-w-[220px]">{fileName}</span> : null}
            <div className={`relative ml-auto inline-flex h-[38px] w-[38px] items-center justify-center text-xs ${overLimit ? "text-[#9f1d1d]" : "text-[#6e716b]"}`} aria-label={`${Math.abs(remaining)} characters ${overLimit ? "over" : "remaining"}`}>
              <svg className="absolute inset-0 h-[38px] w-[38px] -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
                <circle className="fill-none stroke-[#1f242124] stroke-[2.5]" cx="18" cy="18" r="15" />
                <circle
                  className={`fill-none stroke-[2.5] ${overLimit ? "stroke-[#9f1d1d]" : "stroke-[#526f8d]"}`}
                  cx="18"
                  cy="18"
                  r="15"
                  pathLength="100"
                  style={{ strokeDasharray: 100, strokeDashoffset: 100 * (1 - progress) }}
                />
              </svg>
              {overLimit || remaining <= 20 ? <span>{remaining}</span> : null}
            </div>
            {user ? <button className={buttonClass} disabled={overLimit}>Nominate</button> : <Link className={buttonClass} to="/login">Login</Link>}
          </div>
        </div>
      </section>
      <div className="grid gap-2.5 md:grid-cols-[minmax(150px,220px)_minmax(0,1fr)]">
        <label className="grid gap-1.5">
          Type
          <select
            className={fieldClass}
            name="type"
            value={selectedType}
            onChange={(event) => {
              const nextType = event.currentTarget.value as NominationType;
              setSelectedType(nextType);
              if (nextType === "repost") {
                setText("");
                setFileName("");
              }
            }}
          >
            {settings.enabledNominationTypes.map((type) => (
              <option key={type} value={type}>{type === "original" ? "text post" : type === "quote" ? "quote tweet" : type}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="inline-flex items-center gap-1.5">
            Target X post URL
            <span className="group relative inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border border-[#1f242129] text-[#6e716b]" tabIndex={0} aria-label="For reposts, replies, and quotes a URL is required">
              <Info size={15} aria-hidden="true" />
              <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 w-[min(280px,70vw)] -translate-x-1/2 translate-y-1 rounded-md border border-[#1f242129] bg-[#1f2421] px-3 py-2.5 text-sm leading-snug text-[#fffaf0] opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100 group-focus:translate-y-0 group-focus:opacity-100">For reposts, replies, and quotes a URL is required</span>
            </span>
          </span>
          <input className={fieldClass} name="targetTweetUrl" type="url" placeholder="https://x.com/user/status/..." required={needsTargetUrl} />
        </label>
      </div>
      <label className="grid gap-1.5">
        <span className="inline-flex items-center gap-1.5">
          Motivation (optional)
          <span className="group relative inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border border-[#1f242129] text-[#6e716b]" tabIndex={0} aria-label="The motivation will be visible to voters as additional context for the post">
            <Info size={15} aria-hidden="true" />
            <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 w-[min(280px,70vw)] -translate-x-1/2 translate-y-1 rounded-md border border-[#1f242129] bg-[#1f2421] px-3 py-2.5 text-sm leading-snug text-[#fffaf0] opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100 group-focus:translate-y-0 group-focus:opacity-100">The motivation will be visible to voters as additional context for the post</span>
          </span>
        </span>
        <textarea className={`${fieldClass} resize-y`} name="rationale" maxLength={500} rows={3} />
      </label>
    </Form>
  );
}
