import type { AppLoadContext } from "react-router";
import type { Nomination } from "~/domain/nominations";
import { getRepositories } from "~/repositories/drizzle/repositories";
import { getSettings } from "./settings-service";
import { sendQualifiedNomination } from "./publishing-service";

export async function evaluateNomination(context: AppLoadContext, nomination: Nomination) {
  if (nomination.status !== "pending") return;
  const repos = getRepositories(context.cloudflare.env);
  const settings = await getSettings(context);
  const summary = await repos.votes.getVoteSummary(nomination.id);
  const ageMinutes = (Date.now() - new Date(nomination.createdAt).getTime()) / 60000;
  const qualifies =
    summary.total >= settings.minimumTotalVotes &&
    summary.positiveRatio >= settings.minimumPositiveRatio &&
    summary.positiveMargin >= settings.minimumPositiveMargin &&
    ageMinutes >= settings.minimumVotingAgeMinutes;
  if (!qualifies) return;
  await repos.nominations.updateStatus(nomination.id, "qualified", { qualifiedAt: new Date().toISOString() });
  await repos.auditLogs.create({ actorUserId: null, action: "nomination.qualified", entityType: "nomination", entityId: nomination.id, metadata: summary });
  if (settings.publishingWorkflow === "auto_send_when_qualified") {
    await sendQualifiedNomination(context, nomination.id, null);
  }
}
