import type { AppLoadContext } from "react-router";
import { roleNames, type RoleName } from "~/domain/roles";
import { requirePermission } from "~/lib/permissions/permissions";
import { getRepositories } from "~/repositories/drizzle/repositories";
import type { CurrentUser } from "~/repositories/interfaces";

export async function bootstrapUserRoles(context: AppLoadContext, user: CurrentUser) {
  const env = context.cloudflare.env;
  const repos = getRepositories(env);
  await repos.roles.ensureSeedRoles();
  if (env.X_HOST_USER_ID && user.xUserId === env.X_HOST_USER_ID) {
    for (const role of ["spectator", "voter", "admin"] as RoleName[]) {
      await repos.roles.assignRole({ userId: user.id, role, actorUserId: null, assignmentSource: "configured_host" });
    }
  } else if (user.roles.length === 0) {
    await repos.roles.assignRole({ userId: user.id, role: "spectator", actorUserId: null, assignmentSource: "default" });
  }
}

export async function updateUserRole(context: AppLoadContext, actor: CurrentUser, userId: string, role: RoleName, enabled: boolean) {
  requirePermission(actor.roles, "roles:update");
  if (!roleNames.includes(role)) throw new Response("Unknown role", { status: 400 });
  const repos = getRepositories(context.cloudflare.env);
  if (enabled) {
    await repos.roles.assignRole({ userId, role, actorUserId: actor.id, assignmentSource: "manual" });
  } else {
    await repos.roles.removeRole(userId, role);
  }
  await repos.auditLogs.create({ actorUserId: actor.id, action: enabled ? "role.assign" : "role.remove", entityType: "user", entityId: userId, metadata: { role } });
}
