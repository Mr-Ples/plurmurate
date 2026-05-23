import { ArrowLeft } from "lucide-react";
import { Form, Link, redirect, useLoaderData, useLocation, useNavigate } from "react-router";
import { AppShell } from "~/components/AppShell";
import { nominationTypeLabel } from "~/domain/nominations";
import { getCurrentUser } from "~/lib/auth/session";
import { getRepositories } from "~/repositories/drizzle/repositories";
import { getSettings } from "~/services/settings-service";
import { voteOnNomination } from "~/services/vote-service";

const buttonClass = "cursor-pointer rounded-md border border-[#1f2421] bg-[#1f2421] px-3.5 py-2.5 text-[#fffaf0] disabled:cursor-not-allowed disabled:opacity-45";
const fieldClass = "rounded-md border border-[#1f242129] bg-white/45 px-3 py-2.5";
const voteClass = "inline-flex h-10 min-w-[62px] cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#1f242129] bg-white/45 px-3 text-sm font-medium text-[#1f2421] hover:bg-[#fffcf4] disabled:cursor-not-allowed disabled:opacity-45";
const activeVoteClass = "border-[#496d58] bg-[#496d58] text-[#fffaf0] hover:bg-[#496d58]";

export async function loader({ request, context, params }: any) {
  const user = await getCurrentUser(request, context);
  const repos = getRepositories(context.cloudflare.env);
  const nominations = await repos.nominations.listFeed({ viewerUserId: user?.id });
  const nomination = nominations.find((item) => item.id === params.id);
  if (!nomination) throw new Response("Not found", { status: 404 });
  return { user, settings: await getSettings(context), nomination, comments: await repos.votes.listComments(params.id) };
}

export async function action({ request, context, params }: any) {
  const user = await getCurrentUser(request, context);
  if (!user) throw redirect("/login");
  const formData = await request.formData();
  const intent = formData.get("_intent");
  if (intent === "vote") {
    await voteOnNomination(context, user, formData);
  }
  return redirect(`/nominations/${params.id}`);
}

export default function NominationDetail() {
  const { user, settings, nomination, comments } = useLoaderData<typeof loader>();
  const location = useLocation();
  const navigate = useNavigate();
  const isCreator = Boolean(user && nomination.creatorUserId === user.id);
  const canVote = user?.roles.some((role) => ["voter", "publisher", "host", "admin"].includes(role)) && nomination.status === "pending" && (!isCreator || settings.creatorSelfVoteAllowed);
  const from = (location.state as { from?: string } | null)?.from;
  const backTo = from?.startsWith("/") ? from : "/";
  const backClass = "inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-[#1f242129] bg-white/35 px-3 py-2 text-[#1f2421] hover:border-[#1f24214d] hover:bg-[#fffcf4d1]";
  return (
    <AppShell user={user}>
      <main className="grid gap-5 py-[42px] pb-20">
        {from ? (
          <button className={backClass} type="button" onClick={() => navigate(-1)}>
            <ArrowLeft size={17} aria-hidden="true" />
            Back
          </button>
        ) : (
          <Link className={backClass} to={backTo}>
            <ArrowLeft size={17} aria-hidden="true" />
            Back
          </Link>
        )}
        <div className="grid gap-5 md:grid-cols-[1fr_minmax(240px,340px)]">
        <article className="relative overflow-hidden rounded-lg border border-[#1f242129] bg-[#fffcf4d1] p-[18px] shadow-[0_12px_30px_rgba(31,36,33,0.06)]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(82,111,141,0.12),transparent_50%),linear-gradient(45deg,transparent,rgba(140,91,74,0.08))]" />
          <p className="relative m-0 text-xs uppercase tracking-[0.08em] text-[#6e716b]">{nominationTypeLabel(nomination.type)} / {nomination.status}</p>
          <h1 className="relative text-[clamp(1.35rem,3vw,2.25rem)] leading-[1.18] font-medium">{nomination.text ?? nomination.targetTweetUrl}</h1>
          {nomination.targetTweetUrl ? <a className="relative inline-block border-b border-[#526f8d73] text-[#526f8d]" href={nomination.targetTweetUrl}>Target X post {nomination.targetTweetId}</a> : null}
          {nomination.nominationMediaUrl ? <img className="relative my-3.5 block max-h-[420px] w-full rounded-md object-cover" src={nomination.nominationMediaUrl} alt="" /> : null}
          <Form method="post" className="relative flex flex-wrap gap-2.5" title={isCreator && !settings.creatorSelfVoteAllowed ? "You cannot vote on your own nomination." : undefined}>
            <input type="hidden" name="_intent" value="vote" />
            <input type="hidden" name="nominationId" value={nomination.id} />
            <div className="flex gap-2">
              {(["A", "B", "U"] as const).map((value) => (
                <button key={value} className={`${voteClass} ${nomination.userVote === value ? activeVoteClass : ""}`} name="value" value={value} disabled={!canVote} type="submit">
                  <span>{value}</span>
                  <strong>{value === "A" ? nomination.voteA : value === "B" ? nomination.voteB : nomination.voteU}</strong>
                </button>
              ))}
            </div>
            <input className={fieldClass} name="comment" maxLength={400} placeholder="Optional vote comment" disabled={!canVote} />
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
