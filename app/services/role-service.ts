import type { AppLoadContext } from "react-router";
import { roleNames, type RoleName } from "~/domain/roles";
import { requirePermission } from "~/lib/permissions/permissions";
import { getRepositories } from "~/repositories/drizzle/repositories";
import type { CurrentUser } from "~/repositories/interfaces";
import { getSettings } from "./settings-service";

export async function bootstrapUserRoles(context: AppLoadContext, user: CurrentUser) {
  const env = context.cloudflare.env;
  const repos = getRepositories(env);
  await repos.roles.ensureSeedRoles();
  if (env.X_HOST_USER_ID && user.xUserId === env.X_HOST_USER_ID) {
    for (const role of ["spectator", "voter", "admin"] as RoleName[]) {
      await repos.roles.assignRole({ userId: user.id, role, actorUserId: null, assignmentSource: "configured_host" });
    }
  } else {
    const settings = await getSettings(context);
    if (settings.automaticRoleAssignmentEnabled) {
      const username = normalizeUsername(user.username);
      for (const entry of settings.automaticRoleWhitelist) {
        if (username && normalizeUsername(entry.username) === username) {
          await repos.roles.assignRole({ userId: user.id, role: entry.role, actorUserId: null, assignmentSource: "automatic_username" });
        }
      }
      for (const rule of settings.automaticRoleRules) {
        if (rule.subject === "followers" && rule.operator === "more_than" && user.followersCount > rule.value) {
          await repos.roles.assignRole({ userId: user.id, role: rule.role, actorUserId: null, assignmentSource: "automatic_rule" });
        }
      }
    }
  }
  const refreshed = (await repos.users.listUsers()).find((account) => account.id === user.id) ?? user;
  if (refreshed.roles.length === 0) {
    await repos.roles.assignRole({ userId: user.id, role: "spectator", actorUserId: null, assignmentSource: "default" });
  }
}

export async function updateUserRole(context: AppLoadContext, actor: CurrentUser, userId: string, role: RoleName, enabled: boolean) {
  requirePermission(actor.roles, "roles:update");
  if (!roleNames.includes(role)) throw new Response("Unknown role", { status: 400 });
  const repos = getRepositories(context.cloudflare.env);
  if (!enabled) {
    const settings = await getSettings(context);
    const users = await repos.users.listUsers();
    const target = users.find((user) => user.id === userId);
    if (target && isHostUser(target, settings.hostUserId, settings.hostHandle)) {
      throw new Response("Host roles cannot be removed", { status: 400 });
    }
  }
  if (enabled) {
    await repos.roles.assignRole({ userId, role, actorUserId: actor.id, assignmentSource: "manual" });
  } else {
    await repos.roles.removeRole(userId, role);
  }
  await repos.auditLogs.create({ actorUserId: actor.id, action: enabled ? "role.assign" : "role.remove", entityType: "user", entityId: userId, metadata: { role } });
}

function isHostUser(user: CurrentUser, hostUserId: string, hostHandle: string) {
  const cleanHostHandle = hostHandle.replace(/^@/, "").toLowerCase();
  return Boolean(
    (hostUserId && user.xUserId === hostUserId) ||
    (cleanHostHandle && user.username?.toLowerCase() === cleanHostHandle),
  );
}

function normalizeUsername(username: string | null | undefined) {
  return username?.replace(/^@/, "").trim().toLowerCase() ?? "";
}
