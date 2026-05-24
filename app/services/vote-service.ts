import type { AppLoadContext } from "react-router";
import { requirePermission } from "~/lib/permissions/permissions";
import { voteFormSchema } from "~/lib/validation/forms";
import { getRepositories } from "~/repositories/drizzle/repositories";
import type { CurrentUser } from "~/repositories/interfaces";
import { evaluateNomination } from "./approval-service";

export async function voteOnNomination(context: AppLoadContext, actor: CurrentUser, formData: FormData) {
  requirePermission(actor.roles, "nomination:vote");
  const repos = getRepositories(context.cloudflare.env);
  const input = voteFormSchema.parse(Object.fromEntries(formData));
  const nomination = await repos.nominations.findById(input.nominationId);
  if (!nomination) throw new Response("Not found", { status: 404 });
  if (["sent", "withdrawn"].includes(nomination.status)) throw new Response("Voting is closed", { status: 400 });
  const currentVote = await repos.votes.findUserVote(nomination.id, actor.id);
  if (currentVote === input.value) {
    await repos.votes.deleteVote(nomination.id, actor.id);
    await repos.auditLogs.create({ actorUserId: actor.id, action: "vote.delete", entityType: "nomination", entityId: nomination.id, metadata: { value: input.value } });
    return;
  }
  await repos.votes.upsertVote({ nominationId: nomination.id, userId: actor.id, value: input.value, comment: input.comment ?? null });
  await repos.auditLogs.create({ actorUserId: actor.id, action: "vote.upsert", entityType: "nomination", entityId: nomination.id, metadata: { value: input.value } });
  await evaluateNomination(context, nomination);
}
