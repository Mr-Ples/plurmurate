import type { AppLoadContext } from "react-router";
import { newId } from "~/lib/utils/id";
import { getRepositories } from "~/repositories/drizzle/repositories";
import type { CurrentUser } from "~/repositories/interfaces";
import { R2ObjectStorage } from "~/storage/r2-storage";
import { getSettings } from "./settings-service";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const uploadReservationAction = "media.upload.reserve";

export async function assertCanUploadNominationImages(context: AppLoadContext, actor: CurrentUser, imageCount: number) {
  if (imageCount <= 0) return;
  const settings = await getSettings(context);
  if (!settings.imageUploadsEnabled) throw new Response("Image uploads are disabled", { status: 403 });
  const repos = getRepositories(context.cloudflare.env);
  const [recentUploads, dailyUploads] = await Promise.all([
    countRecentUploadReservations(repos, actor.id, settings.imageUploadRateLimitWindowMinutes),
    countRecentUploadReservations(repos, actor.id, 24 * 60),
  ]);
  if (dailyUploads + imageCount > settings.imageUploadDailyLimitMaxImages) {
    throw uploadDailyLimitResponse(settings.imageUploadDailyLimitMaxImages);
  }
  if (recentUploads + imageCount > settings.imageUploadRateLimitMaxImages) {
    throw uploadRateLimitResponse(settings.imageUploadRateLimitMaxImages, settings.imageUploadRateLimitWindowMinutes);
  }
}

export async function storeNominationImage(context: AppLoadContext, actor: CurrentUser, nominationId: string, file: File, kind: "tweet_avatar" | "nomination_image", publicBaseUrl: string) {
  const settings = await getSettings(context);
  if (!settings.imageUploadsEnabled) throw new Response("Image uploads are disabled", { status: 403 });
  const repos = getRepositories(context.cloudflare.env);
  const [recentUploads, dailyUploads] = await Promise.all([
    countRecentUploadReservations(repos, actor.id, settings.imageUploadRateLimitWindowMinutes),
    countRecentUploadReservations(repos, actor.id, 24 * 60),
  ]);
  if (dailyUploads >= settings.imageUploadDailyLimitMaxImages) {
    throw uploadDailyLimitResponse(settings.imageUploadDailyLimitMaxImages);
  }
  if (recentUploads >= settings.imageUploadRateLimitMaxImages) {
    throw uploadRateLimitResponse(settings.imageUploadRateLimitMaxImages, settings.imageUploadRateLimitWindowMinutes);
  }
  if (!allowedTypes.has(file.type)) throw new Response("Only JPEG, PNG, and WebP images are allowed", { status: 400 });
  if (file.size > settings.maxImageUploadBytes) throw new Response("Image is too large", { status: 400 });
  const env = context.cloudflare.env;
  await repos.auditLogs.create({
    actorUserId: actor.id,
    action: uploadReservationAction,
    entityType: "nomination",
    entityId: nominationId,
    metadata: { kind, sizeBytes: file.size, mimeType: file.type },
  });
  const storage = new R2ObjectStorage(env.MEDIA_BUCKET);
  const extension = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "bin";
  const key = `${actor.id}/${nominationId}/${kind}-${newId("obj")}.${extension}`;
  const stored = await storage.put({ key, body: await file.arrayBuffer(), contentType: file.type, publicBaseUrl });
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

function countRecentUploadReservations(repos: ReturnType<typeof getRepositories>, actorUserId: string, windowMinutes: number) {
  return repos.auditLogs.countRecent({
    actorUserId,
    action: uploadReservationAction,
    since: new Date(Date.now() - windowMinutes * 60 * 1000),
  });
}

function uploadRateLimitResponse(maxImages: number, windowMinutes: number) {
  return new Response(`Image upload rate limit exceeded. Try again later. Limit: ${maxImages} images per ${windowMinutes} minutes.`, {
    status: 429,
    headers: { "Retry-After": String(windowMinutes * 60) },
  });
}

function uploadDailyLimitResponse(maxImages: number) {
  return new Response(`Daily image upload limit exceeded. Limit: ${maxImages} images per 24 hours.`, {
    status: 429,
    headers: { "Retry-After": String(24 * 60 * 60) },
  });
}
