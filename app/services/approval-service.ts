import type { AppLoadContext } from "react-router";
import type { Nomination } from "~/domain/nominations";
import { getRepositories } from "~/repositories/drizzle/repositories";
import { getSettings } from "./settings-service";
import { queueDiscordNotification } from "./discord-service";

export async function evaluateNomination(context: AppLoadContext, nomination: Nomination) {
  if (nomination.status !== "pending") return;
  const repos = getRepositories(context.cloudflare.env);
  const settings = await getSettings(context);
  const summary = await repos.votes.getVoteSummary(nomination.id);
  if (summary.total === 0) return;
  const qualifies =
    thresholdPasses(summary.total, settings.minimumTotalVotes) &&
    thresholdPasses(summary.positiveRatio, settings.minimumPositiveRatio) &&
    thresholdPasses(summary.positiveMargin, settings.minimumPositiveMargin);
  if (!qualifies) return;
  const didQualify = await repos.nominations.qualifyPending(nomination.id, new Date().toISOString());
  if (!didQualify) return;
  await repos.auditLogs.create({ actorUserId: null, action: "nomination.qualified", entityType: "nomination", entityId: nomination.id, metadata: summary });
  queueDiscordNotification(context, { kind: "nomination_qualified", nomination, summary });
}

export async function evaluatePendingNominations(context: AppLoadContext) {
  const repos = getRepositories(context.cloudflare.env);
  const nominations = await repos.nominations.listFeed({ status: "pending" });
  for (const nomination of nominations) {
    await evaluateNomination(context, nomination);
  }
}

function thresholdPasses(value: number, threshold: number | null) {
  return threshold === null || value >= threshold;
}
