import type { AppLoadContext } from "react-router";
import { newId } from "~/lib/utils/id";
import { getRepositories } from "~/repositories/drizzle/repositories";
import type { CurrentUser } from "~/repositories/interfaces";
import { R2ObjectStorage } from "~/storage/r2-storage";
import { getSettings } from "./settings-service";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function storeNominationImage(context: AppLoadContext, actor: CurrentUser, nominationId: string, file: File, kind: "tweet_avatar" | "nomination_image", publicBaseUrl: string) {
  const settings = await getSettings(context);
  if (!allowedTypes.has(file.type)) throw new Response("Only JPEG, PNG, and WebP images are allowed", { status: 400 });
  if (file.size > settings.maxImageUploadBytes) throw new Response("Image is too large", { status: 400 });
  const env = context.cloudflare.env;
  const storage = new R2ObjectStorage(env.MEDIA_BUCKET);
  const extension = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "bin";
  const key = `${actor.id}/${nominationId}/${kind}-${newId("obj")}.${extension}`;
  const stored = await storage.put({ key, body: await file.arrayBuffer(), contentType: file.type, publicBaseUrl });
  const repos = getRepositories(env);
  const media = await repos.media.create({
    ownerUserId: actor.id,
    nominationId,
    kind,
    storageKey: stored.key,
    publicUrl: stored.publicUrl,
    mimeType: file.type,
    sizeBytes: file.size,
  });
  await repos.nominations.attachMedia(nominationId, kind === "tweet_avatar" ? "tweetAvatarMediaId" : "nominationMediaId", media.id);
  return media;
}
