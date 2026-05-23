import { ArrowLeft } from "lucide-react";
import { Form, Link, redirect, useLoaderData, useLocation } from "react-router";
import { AppShell } from "~/components/AppShell";
import { nominationTypeLabel } from "~/domain/nominations";
import { getCurrentUser } from "~/lib/auth/session";
import { getRepositories } from "~/repositories/drizzle/repositories";
import { storeNominationImage } from "~/services/media-service";
import { voteOnNomination } from "~/services/vote-service";

const buttonClass = "cursor-pointer rounded-md border border-[#1f2421] bg-[#1f2421] px-3.5 py-2.5 text-[#fffaf0] disabled:cursor-not-allowed disabled:opacity-45";
const fieldClass = "rounded-md border border-[#1f242129] bg-white/45 px-3 py-2.5";

export async function loader({ request, context, params }: any) {
  const user = await getCurrentUser(request, context);
  const repos = getRepositories(context.cloudflare.env);
  const nominations = await repos.nominations.listFeed({ viewerUserId: user?.id });
  const nomination = nominations.find((item) => item.id === params.id);
  if (!nomination) throw new Response("Not found", { status: 404 });
  return { user, nomination, comments: await repos.votes.listComments(params.id) };
}

export async function action({ request, context, params }: any) {
  const user = await getCurrentUser(request, context);
  if (!user) throw redirect("/login");
  const formData = await request.formData();
  const intent = formData.get("_intent");
  if (intent === "vote") {
    await voteOnNomination(context, user, formData);
  }
  if (intent === "upload") {
    const file = formData.get("image");
    const kind = formData.get("kind") === "tweet_avatar" ? "tweet_avatar" : "nomination_image";
    if (!(file instanceof File) || file.size === 0) throw new Response("Image is required", { status: 400 });
    await storeNominationImage(context, user, params.id, file, kind, new URL(request.url).origin);
  }
  return redirect(`/nominations/${params.id}`);
}

export default function NominationDetail() {
  const { user, nomination, comments } = useLoaderData<typeof loader>();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const backTo = from?.startsWith("/") ? from : "/";
  return (
    <AppShell user={user}>
      <main className="grid gap-5 py-[42px] pb-20">
        <Link className="inline-flex w-fit items-center gap-1.5 rounded-md border border-[#1f242129] bg-white/35 px-3 py-2 text-[#1f2421] hover:border-[#1f24214d] hover:bg-[#fffcf4d1]" to={backTo}>
          <ArrowLeft size={17} aria-hidden="true" />
          Back
        </Link>
        <div className="grid gap-5 md:grid-cols-[1fr_minmax(240px,340px)]">
        <article className="relative overflow-hidden rounded-lg border border-[#1f242129] bg-[#fffcf4d1] p-[18px] shadow-[0_12px_30px_rgba(31,36,33,0.06)]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(82,111,141,0.12),transparent_50%),linear-gradient(45deg,transparent,rgba(140,91,74,0.08))]" />
          <p className="relative m-0 text-xs uppercase tracking-[0.08em] text-[#6e716b]">{nominationTypeLabel(nomination.type)} / {nomination.status}</p>
          <h1 className="relative font-serif text-[clamp(2rem,6vw,5rem)] leading-[0.98] font-medium">{nomination.text ?? nomination.targetTweetUrl}</h1>
          {nomination.targetTweetUrl ? <a className="relative inline-block border-b border-[#526f8d73] text-[#526f8d]" href={nomination.targetTweetUrl}>Target X post {nomination.targetTweetId}</a> : null}
          {nomination.nominationMediaUrl ? <img className="relative my-3.5 block max-h-[420px] w-full rounded-md object-cover" src={nomination.nominationMediaUrl} alt="" /> : null}
          <Form method="post" className="relative flex flex-wrap gap-2.5">
            <input type="hidden" name="_intent" value="vote" />
            <input type="hidden" name="nominationId" value={nomination.id} />
            <select className={fieldClass} name="value" defaultValue={nomination.userVote ?? "A"}>
              <option>A</option>
              <option>B</option>
              <option>U</option>
            </select>
            <input className={fieldClass} name="comment" maxLength={400} placeholder="Optional vote comment" />
            <button className={buttonClass}>Vote</button>
          </Form>
          <Form method="post" encType="multipart/form-data" className="relative mt-2.5 flex flex-wrap gap-2.5">
            <input type="hidden" name="_intent" value="upload" />
            <select className={fieldClass} name="kind">
              <option value="nomination_image">Nomination image</option>
              <option value="tweet_avatar">Tweet avatar</option>
            </select>
            <input className={fieldClass} name="image" type="file" accept="image/png,image/jpeg,image/webp" />
            <button className={buttonClass}>Upload</button>
          </Form>
        </article>
        <section className="overflow-auto rounded-lg border border-[#1f242129] bg-[#fffcf4ad] p-4">
          <h2>Vote comments</h2>
          {comments.length ? comments.map((comment, index) => <p key={index}><strong>{comment.value}</strong> @{comment.username}: {comment.comment}</p>) : <p>No vote comments yet.</p>}
        </section>
        </div>
      </main>
    </AppShell>
  );
}
