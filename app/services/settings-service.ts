import type { AppLoadContext } from "react-router";
import { appSettingsSchema, type AppSettings } from "~/domain/settings";
import { requirePermission } from "~/lib/permissions/permissions";
import { getRepositories } from "~/repositories/drizzle/repositories";
import type { CurrentUser } from "~/repositories/interfaces";

export function envSettings(context: AppLoadContext): Partial<AppSettings> {
  const env = context.cloudflare.env;
  return {
    publishingWorkflow: env.PUBLISHING_WORKFLOW === "auto_send_when_qualified" ? "auto_send_when_qualified" : "manual_review_when_qualified",
    hostUserId: env.X_HOST_USER_ID ?? "",
    hostHandle: env.X_HOST_HANDLE ?? "",
  };
}

export async function getSettings(context: AppLoadContext) {
  return getRepositories(context.cloudflare.env).settings.getSettings(envSettings(context));
}

export async function updateSettings(context: AppLoadContext, actor: CurrentUser, value: unknown) {
  requirePermission(actor.roles, "settings:update");
  const repos = getRepositories(context.cloudflare.env);
  const settings = appSettingsSchema.parse(value);
  await repos.settings.updateSettings(settings, actor.id);
  await repos.auditLogs.create({ actorUserId: actor.id, action: "settings.update", entityType: "settings", entityId: "app", metadata: settings });
}
