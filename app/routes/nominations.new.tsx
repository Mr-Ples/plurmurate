import { Image, Info } from "lucide-react";
import { useRef, useState } from "react";
import { Form, Link, redirect, useLoaderData } from "react-router";
import { AppShell } from "~/components/AppShell";
import type { NominationType } from "~/domain/nominations";
import { getCurrentUser } from "~/lib/auth/session";
import { createNomination } from "~/services/nomination-service";
import { storeNominationImage } from "~/services/media-service";
import { getSettings } from "~/services/settings-service";
import { voteOnNomination } from "~/services/vote-service";

export async function loader({ request, context }: any) {
  const user = await getCurrentUser(request, context);
  const settings = await getSettings(context);
  return { user, settings };
}

export async function action({ request, context }: any) {
  const user = await getCurrentUser(request, context);
  if (!user) throw redirect("/login");
  const formData = await request.formData();
  if (formData.get("_intent") === "vote") {
    await voteOnNomination(context, user, formData);
    return null;
  }
  const nomination = await createNomination(context, user, formData);
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    await storeNominationImage(context, user, nomination.id, image, "nomination_image", new URL(request.url).origin);
  }
  return redirect(`/nominations/${nomination.id}`);
}

export default function NewNomination() {
  const { user, settings } = useLoaderData<typeof loader>();
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
    <AppShell user={user}>
      <main className="form-page">
        <h1>New post</h1>
        <Form method="post" encType="multipart/form-data" className="editor-form">
          <section className={`composer ${isRepost ? "is-muted" : ""}`}>
            {user?.profileImageUrl ? (
              <img className="composer-avatar" src={user.profileImageUrl} alt="" />
            ) : (
              <div className="composer-avatar placeholder-avatar" aria-hidden="true">?</div>
            )}
            <div className="composer-main">
              <label className="sr-only" htmlFor="nomination-text">Post text</label>
              <div className="text-composer">
                {text ? (
                  <div className="text-highlight" aria-hidden="true" ref={highlightRef}>
                    <span>{text.slice(0, limit)}</span>
                    {overLimit ? <mark>{text.slice(limit)}</mark> : null}
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
                  className={text ? "has-highlight" : ""}
                />
              </div>
              <div className="composer-actions">
                {user && !isRepost ? (
                  <label className="icon-button" title={fileName || "Add media"}>
                    <Image size={19} aria-hidden="true" />
                    <span className="sr-only">Add media</span>
                    <input
                      name="image"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => setFileName(event.currentTarget.files?.[0]?.name ?? "")}
                    />
                  </label>
                ) : !user ? (
                  <Link className="icon-button" to="/login" title="Login to add media">
                    <Image size={19} aria-hidden="true" />
                    <span className="sr-only">Login to add media</span>
                  </Link>
                ) : (
                  <span className="icon-button is-disabled" title="Reposts cannot include media">
                    <Image size={19} aria-hidden="true" />
                    <span className="sr-only">Reposts cannot include media</span>
                  </span>
                )}
                {fileName ? <span className="selected-file">{fileName}</span> : null}
                <div className={`limit-meter ${overLimit ? "over-limit" : ""}`} aria-label={`${Math.abs(remaining)} characters ${overLimit ? "over" : "remaining"}`}>
                  <svg viewBox="0 0 36 36" aria-hidden="true">
                    <circle cx="18" cy="18" r="15" />
                    <circle
                      cx="18"
                      cy="18"
                      r="15"
                      pathLength="100"
                      style={{ strokeDasharray: 100, strokeDashoffset: 100 * (1 - progress) }}
                    />
                  </svg>
                  {(overLimit || remaining <= 20) ? <span>{remaining}</span> : null}
                </div>
                {user ? <button disabled={overLimit}>Nominate</button> : <Link className="primary-action" to="/login">Login</Link>}
              </div>
            </div>
          </section>
          <div className="metadata-row">
            <label>
              Type
              <select
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
            <label>
              <span className="field-title">
                Target X post URL
                <span className="info-tip" tabIndex={0} aria-label="For reposts, replies, and quotes a URL is required">
                  <Info size={15} aria-hidden="true" />
                </span>
              </span>
              <input name="targetTweetUrl" type="url" placeholder="https://x.com/user/status/..." required={needsTargetUrl} />
            </label>
          </div>
          <label>
            <span className="field-title">
              Motivation (optional)
              <span className="info-tip" tabIndex={0} aria-label="The motivation will be visible to voters as additional context for the post">
                <Info size={15} aria-hidden="true" />
              </span>
            </span>
            <textarea name="rationale" maxLength={500} rows={3} />
          </label>
          {/* <p className="form-note">Tweet avatar mode: {settings.tweetAvatarMode}. Uploads can be attached from the nomination detail screen.</p> */}
        </Form>
      </main>
    </AppShell>
  );
}
