import type { AppLoadContext } from "react-router";
import { nominationFormSchema } from "~/lib/validation/forms";
import { requirePermission } from "~/lib/permissions/permissions";
import { parseTweetUrl } from "~/lib/utils/tweets";
import { getRepositories } from "~/repositories/drizzle/repositories";
import type { CurrentUser } from "~/repositories/interfaces";
import { fetchAndCacheExternalTweet } from "./external-tweet-service";
import { getSettings } from "./settings-service";
import { queueDiscordNotification } from "./discord-service";

export async function createNomination(context: AppLoadContext, actor: CurrentUser, formData: FormData, appOrigin?: string | null) {
  requirePermission(actor.roles, "nomination:create");
  const settings = await getSettings(context);
  const parsed = nominationFormSchema.parse(Object.fromEntries(formData));
  if (!settings.enabledNominationTypes.includes(parsed.type)) throw new Response("Nomination type disabled", { status: 400 });
  const needsTarget = parsed.type === "quote" || parsed.type === "repost" || parsed.type === "reply";
  const target = parseTweetUrl(parsed.targetTweetUrl);
  if (needsTarget && !target) throw new Response("A valid X post URL is required", { status: 400 });
  if (parsed.type !== "repost" && !parsed.text) throw new Response("Text is required", { status: 400 });
  const repos = getRepositories(context.cloudflare.env);
  const nomination = await repos.nominations.create({
    creatorUserId: actor.id,
    type: parsed.type,
    status: "pending",
    text: parsed.type === "repost" ? null : parsed.text,
    targetTweetUrl: target?.url ?? null,
    targetTweetId: target?.tweetId ?? null,
    rationale: parsed.rationale || null,
  });
  await repos.auditLogs.create({ actorUserId: actor.id, action: "nomination.create", entityType: "nomination", entityId: nomination.id, metadata: { type: nomination.type } });
  queueDiscordNotification(context, { kind: "new_nomination", nomination, actor, appOrigin });
  if (target) {
    await fetchAndCacheExternalTweet(context, target.tweetId, target.url).catch(() => null);
  }
  return nomination;
}

export async function moderateNomination(context: AppLoadContext, actor: CurrentUser, nominationId: string, intent: string, decisionRationale?: string) {
  requirePermission(actor.roles, intent === "send" ? "nomination:send" : "nomination:moderate");
  const repos = getRepositories(context.cloudflare.env);
  const rationale = cleanDecisionRationale(decisionRationale);
  if (intent === "approve") {
    await repos.nominations.updateStatus(nominationId, "approved", { approvedAt: new Date().toISOString(), decisionRationale: rationale });
  } else if (intent === "deny") {
    await repos.nominations.updateStatus(nominationId, "denied", { decisionRationale: rationale });
  } else if (intent === "archive") {
    await repos.nominations.updateStatus(nominationId, "withdrawn", { hiddenAt: new Date().toISOString(), decisionRationale: rationale });
  } else {
    throw new Response("Unknown moderation action", { status: 400 });
  }
  await repos.auditLogs.create({ actorUserId: actor.id, action: `nomination.${intent}`, entityType: "nomination", entityId: nominationId, metadata: { decisionRationale: rationale } });
}

function cleanDecisionRationale(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed.slice(0, 500) : null;
}
