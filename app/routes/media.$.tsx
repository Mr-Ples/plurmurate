import { getRepositories } from "~/repositories/drizzle/repositories";
import { R2ObjectStorage } from "~/storage/r2-storage";

export async function loader({ params, context }: any) {
  const key = params["*"];
  if (!key) throw new Response("Not found", { status: 404 });
  const storage = new R2ObjectStorage(context.cloudflare.env.MEDIA_BUCKET);
  const body = await storage.get(key);
  if (!body) throw new Response("Not found", { status: 404 });
  const repos = getRepositories(context.cloudflare.env);
  const media = await repos.media.findById(key);
  return new Response(body, { headers: { "Content-Type": media?.mimeType ?? "application/octet-stream", "Cache-Control": "public, max-age=3600" } });
}
