import type { AppLoadContext } from "react-router";
import { requirePermission } from "~/lib/permissions/permissions";
import { getRepositories } from "~/repositories/drizzle/repositories";
import type { CurrentUser } from "~/repositories/interfaces";
import { LiveXClient } from "~/x/live-x-client";
import { getSettings } from "./settings-service";

export async function sendQualifiedNomination(context: AppLoadContext, nominationId: string, actor: CurrentUser | null) {
  if (actor) requirePermission(actor.roles, "nomination:send");
  const env = context.cloudflare.env;
  const repos = getRepositories(env);
  const nomination = await repos.nominations.findById(nominationId);
  if (!nomination) throw new Response("Not found", { status: 404 });
  if (!["qualified", "approved", "failed"].includes(nomination.status)) throw new Response("Nomination is not sendable", { status: 400 });
  const settings = await getSettings(context);
  const accessToken = env.X_PUBLISHING_ACCESS_TOKEN;
  if (!accessToken || !env.X_HOST_USER_ID) throw new Error("Publishing credentials are not configured");
  const client = new LiveXClient(env.X_CLIENT_ID, env.X_CLIENT_SECRET);
  const request = {
    type: nomination.type,
    text: nomination.text,
    targetTweetId: nomination.targetTweetId,
    hostUserId: settings.hostUserId || env.X_HOST_USER_ID,
  };
  try {
    let response: { tweetId: string; url?: string };
    if (nomination.type === "repost") {
      if (!nomination.targetTweetId) throw new Error("Repost target is missing");
      response = await client.repost({ hostUserId: request.hostUserId, tweetId: nomination.targetTweetId, accessToken });
      response.url = nomination.targetTweetUrl ?? undefined;
    } else {
      response = await client.createTweet({
        text: nomination.text,
        quoteTweetId: nomination.type === "quote" ? nomination.targetTweetId : null,
        replyToTweetId: nomination.type === "reply" ? nomination.targetTweetId : null,
        accessToken,
      });
    }
    await repos.publishAttempts.create({
      nominationId,
      workflow: settings.publishingWorkflow,
      actorUserId: actor?.id ?? null,
      xOperation: nomination.type,
      requestJson: request,
      responseJson: response,
      status: "success",
    });
    await repos.nominations.updateStatus(nominationId, "sent", {
      sentAt: new Date().toISOString(),
      publishedTweetId: response.tweetId,
      publishedTweetUrl: response.url ?? null,
    });
    await repos.auditLogs.create({ actorUserId: actor?.id ?? null, action: "nomination.send", entityType: "nomination", entityId: nominationId, metadata: response });
  } catch (error) {
    await repos.publishAttempts.create({
      nominationId,
      workflow: settings.publishingWorkflow,
      actorUserId: actor?.id ?? null,
      xOperation: nomination.type,
      requestJson: request,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown publishing failure",
    });
    await repos.nominations.updateStatus(nominationId, "failed");
    throw error;
  }
}
