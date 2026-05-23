import { Image, Info, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Form, Link } from "react-router";
import { nominationTypeLabel, type NominationType } from "~/domain/nominations";
import type { AppSettings } from "~/domain/settings";
import type { CurrentUser } from "~/repositories/interfaces";

const buttonClass = "cursor-pointer rounded-md border border-[#1f2421] bg-[#1f2421] px-3.5 py-2.5 text-[#fffaf0] disabled:cursor-not-allowed disabled:opacity-45";
const fieldClass = "rounded-md border border-[#1f242129] bg-white/45 px-3 py-2.5";
const iconButtonClass = "inline-flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-md border border-[#1f242129] text-[#526f8d]";
const srOnlyClass = "absolute -m-px h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]";
const maxPreviewImages = 4;

type SelectedImage = {
  id: string;
  file: File;
  url: string;
};

export function NewNominationForm({ user, settings }: { user: CurrentUser | null; settings: AppSettings }) {
  const [selectedType, setSelectedType] = useState<NominationType>(settings.enabledNominationTypes[0] ?? "original");
  const [text, setText] = useState("");
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [posting, setPosting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedImagesRef = useRef<SelectedImage[]>([]);
  const limit = 280;
  const count = text.length;
  const overLimit = count > limit;
  const progress = Math.min(count / limit, 1);
  const remaining = limit - count;
  const needsTargetUrl = selectedType === "quote" || selectedType === "repost" || selectedType === "reply";
  const isRepost = selectedType === "repost";
  const mediaTitle = selectedImages.length
    ? `${selectedImages.length} image${selectedImages.length === 1 ? "" : "s"} selected`
    : "Add media";
  const mediaLimitReached = selectedImages.length >= maxPreviewImages;

  useEffect(() => {
    selectedImagesRef.current = selectedImages;
  }, [selectedImages]);

  useEffect(() => {
    return () => {
      selectedImagesRef.current.forEach((image) => URL.revokeObjectURL(image.url));
    };
  }, []);

  function updateInputFiles(images: SelectedImage[]) {
    if (!fileInputRef.current) return;
    const dataTransfer = new DataTransfer();
    images.forEach((image) => dataTransfer.items.add(image.file));
    fileInputRef.current.files = dataTransfer.files;
  }

  function clearSelectedImages() {
    setSelectedImages((current) => {
      current.forEach((image) => URL.revokeObjectURL(image.url));
      return [];
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleMediaChange(files: FileList | null) {
    setSelectedImages((current) => {
      const nextFiles = [...current.map((image) => image.file), ...Array.from(files ?? [])].slice(0, maxPreviewImages);
      const next = nextFiles.map((file, index) => {
        const existing = current[index];
        if (existing?.file === file) return existing;
        return {
          id: `${file.name}-${file.lastModified}-${file.size}-${index}`,
          file,
          url: URL.createObjectURL(file),
        };
      });
      current.forEach((image) => {
        if (!next.some((nextImage) => nextImage.url === image.url)) URL.revokeObjectURL(image.url);
      });
      updateInputFiles(next);
      return next;
    });
  }

  function removeSelectedImage(id: string) {
    setSelectedImages((current) => {
      const next = current.filter((image) => image.id !== id);
      const removed = current.find((image) => image.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      updateInputFiles(next);
      return next;
    });
  }

  return (
    <Form
      id="new-post"
      method="post"
      encType="multipart/form-data"
      className="relative flex flex-col gap-2.5"
      ref={formRef}
      onSubmit={() => {
        setPosting(true);
        window.setTimeout(() => setPosting(false), 1800);
        window.setTimeout(() => {
          setText("");
          clearSelectedImages();
          formRef.current?.reset();
        }, 0);
      }}
    >
      <input type="hidden" name="_intent" value="create" />
      {posting ? (
        <div className="absolute inset-0 z-30 grid place-items-center rounded-lg bg-[#fffcf4cc] backdrop-blur-[2px]" aria-live="polite" aria-label="Posting">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#1f242129] border-t-[#1f2421]" />
        </div>
      ) : null}
      <section className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 rounded-lg border border-[#1f242129] bg-[#fffcf4d1] p-3 md:grid-cols-[52px_minmax(0,1fr)] md:gap-3.5 md:p-4">
        {user?.profileImageUrl ? (
          <img className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ddd4c5] object-cover md:h-12 md:w-12" src={user.profileImageUrl} alt="" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#1f242129] bg-[#ddd4c5] font-semibold text-[#6e716b] md:h-12 md:w-12" aria-hidden="true">?</div>
        )}
        <div className="min-w-0">
          <label className={srOnlyClass} htmlFor="nomination-text">Post text</label>
          <div className="relative h-[138px]">
            {text ? (
              <div
                className="pointer-events-none absolute inset-0 h-[138px] overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-transparent bg-transparent p-2 text-[1.18rem] leading-[1.4] text-transparent [scrollbar-gutter:stable]"
                aria-hidden="true"
                ref={highlightRef}
              >
                <span>{text.slice(0, limit)}</span>
                {overLimit ? <mark className="rounded-[2px] bg-[#d9444433] text-transparent">{text.slice(limit)}</mark> : null}
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
              className="relative z-10 h-[138px] w-full resize-none overflow-y-auto rounded-md border border-transparent bg-transparent p-2 text-[1.18rem] leading-[1.4] text-[#1f2421] outline-none placeholder:text-[#6e716b] [scrollbar-gutter:stable]"
            />
          </div>
          {selectedImages.length ? (
            <div
              className={`mt-3 grid overflow-hidden rounded-xl border border-[#1f242129] bg-[#1f24210a] ${
                selectedImages.length === 1 ? "grid-cols-1" : "grid-cols-2"
              }`}
              aria-label="Selected media"
            >
              {selectedImages.map((image, index) => (
                <div
                  className={`relative overflow-hidden bg-[#ddd4c5] ${
                    selectedImages.length === 3 && index === 0 ? "row-span-2" : ""
                  } ${index > 0 ? "border-l border-[#1f242129]" : ""} ${index > 1 ? "border-t border-[#1f242129]" : ""}`}
                  key={image.id}
                >
                  <img
                    className={`w-full object-cover ${
                      selectedImages.length === 1
                        ? "max-h-[420px] min-h-[132px] md:min-h-[170px]"
                        : selectedImages.length === 3 && index === 0
                          ? "h-[264px] md:h-[340px]"
                          : "h-[132px] md:h-[170px]"
                    }`}
                    src={image.url}
                    alt={image.file.name}
                  />
                  <button
                    className="absolute top-2 right-2 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#0f1419cc] text-white shadow-[0_2px_8px_rgba(0,0,0,0.22)] hover:bg-[#0f1419]"
                    type="button"
                    onClick={() => removeSelectedImage(image.id)}
                    aria-label={`Remove ${image.file.name}`}
                    title="Remove"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex items-center gap-2.5 border-t border-[#1f242129] pt-3">
            {user && !isRepost ? (
              <label
                className={`${iconButtonClass} ${mediaLimitReached ? "cursor-not-allowed opacity-45" : ""}`}
                title={mediaLimitReached ? "Maximum 4 images" : mediaTitle}
                aria-disabled={mediaLimitReached}
                onClick={(event) => {
                  if (mediaLimitReached) event.preventDefault();
                }}
              >
                <Image size={19} aria-hidden="true" />
                <span className={srOnlyClass}>Add media</span>
                <input
                  ref={fileInputRef}
                  className="hidden"
                  name="image"
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => handleMediaChange(event.currentTarget.files)}
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
            {user ? <button className={buttonClass} disabled={overLimit}>Post</button> : <Link className={buttonClass} to="/login">Login</Link>}
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
                clearSelectedImages();
              }
            }}
          >
            {settings.enabledNominationTypes.map((type) => (
              <option key={type} value={type}>{nominationTypeLabel(type)}</option>
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
