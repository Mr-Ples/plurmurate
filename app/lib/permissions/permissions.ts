import type { Permission, RoleName } from "~/domain/roles";

const map: Record<Permission, RoleName[]> = {
  "nomination:create": ["voter", "admin"],
  "nomination:vote": ["voter", "admin"],
  "nomination:moderate": ["admin"],
  "nomination:send": ["admin"],
  "settings:update": ["admin"],
  "roles:update": ["admin"],
};

export function hasPermission(roles: RoleName[], permission: Permission) {
  return map[permission].some((role) => roles.includes(role));
}

export function requirePermission(roles: RoleName[], permission: Permission) {
  if (!hasPermission(roles, permission)) {
    throw new Response("Forbidden", { status: 403 });
  }
}
