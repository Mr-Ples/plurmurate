import type { AppLoadContext } from "react-router";
import { requirePermission } from "~/lib/permissions/permissions";
import { voteFormSchema } from "~/lib/validation/forms";
import { getRepositories } from "~/repositories/drizzle/repositories";
import type { CurrentUser } from "~/repositories/interfaces";
import { evaluateNomination } from "./approval-service";
import { getSettings } from "./settings-service";

export async function voteOnNomination(context: AppLoadContext, actor: CurrentUser, formData: FormData) {
  requirePermission(actor.roles, "nomination:vote");
  const repos = getRepositories(context.cloudflare.env);
  const input = voteFormSchema.parse(Object.fromEntries(formData));
  const nomination = await repos.nominations.findById(input.nominationId);
  if (!nomination) throw new Response("Not found", { status: 404 });
  if (nomination.status !== "pending") throw new Response("Voting is closed", { status: 400 });
  const settings = await getSettings(context);
  if (!settings.creatorSelfVoteAllowed && nomination.creatorUserId === actor.id) {
    throw new Response("Creator self-vote is disabled", { status: 400 });
  }
  await repos.votes.upsertVote({ nominationId: nomination.id, userId: actor.id, value: input.value, comment: input.comment ?? null });
  await repos.auditLogs.create({ actorUserId: actor.id, action: "vote.upsert", entityType: "nomination", entityId: nomination.id, metadata: { value: input.value } });
  await evaluateNomination(context, nomination);
}
