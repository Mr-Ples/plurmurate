import { Form, redirect, useLoaderData } from "react-router";
import { AppShell } from "~/components/AppShell";
import { getCurrentUser } from "~/lib/auth/session";
import { getRepositories } from "~/repositories/drizzle/repositories";
import { storeNominationImage } from "~/services/media-service";
import { voteOnNomination } from "~/services/vote-service";

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
  if (!user) throw new Response("Unauthorized", { status: 401 });
  const formData = await request.formData();
  const intent = formData.get("_intent");
  if (intent === "vote") {
    await voteOnNomination(context, user, formData);
  }
  if (intent === "upload") {
    const file = formData.get("image");
    const kind = formData.get("kind") === "tweet_avatar" ? "tweet_avatar" : "nomination_image";
    if (!(file instanceof File) || file.size === 0) throw new Response("Image is required", { status: 400 });
    await storeNominationImage(context, user, params.id, file, kind);
  }
  return redirect(`/nominations/${params.id}`);
}

export default function NominationDetail() {
  const { user, nomination, comments } = useLoaderData<typeof loader>();
  return (
    <AppShell user={user}>
      <main className="detail-page">
        <article className="nomination detail">
          <p className="eyebrow">{nomination.type} / {nomination.status}</p>
          <h1>{nomination.text ?? nomination.targetTweetUrl}</h1>
          {nomination.targetTweetUrl ? <a className="target" href={nomination.targetTweetUrl}>Target X post {nomination.targetTweetId}</a> : null}
          {nomination.nominationMediaUrl ? <img className="media-preview" src={nomination.nominationMediaUrl} alt="" /> : null}
          <Form method="post" className="comment-vote">
            <input type="hidden" name="_intent" value="vote" />
            <input type="hidden" name="nominationId" value={nomination.id} />
            <select name="value" defaultValue={nomination.userVote ?? "A"}>
              <option>A</option>
              <option>B</option>
              <option>U</option>
            </select>
            <input name="comment" maxLength={400} placeholder="Optional vote comment" />
            <button>Vote</button>
          </Form>
          <Form method="post" encType="multipart/form-data" className="upload-form">
            <input type="hidden" name="_intent" value="upload" />
            <select name="kind">
              <option value="nomination_image">Nomination image</option>
              <option value="tweet_avatar">Tweet avatar</option>
            </select>
            <input name="image" type="file" accept="image/png,image/jpeg,image/webp" />
            <button>Upload</button>
          </Form>
        </article>
        <section className="comments">
          <h2>Vote comments</h2>
          {comments.length ? comments.map((comment, index) => <p key={index}><strong>{comment.value}</strong> @{comment.username}: {comment.comment}</p>) : <p>No vote comments yet.</p>}
        </section>
      </main>
    </AppShell>
  );
}
