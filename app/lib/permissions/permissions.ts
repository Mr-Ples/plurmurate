import type { Permission, RoleName } from "~/domain/roles";

const map: Record<Permission, RoleName[]> = {
  "nomination:create": ["voter", "publisher", "host", "admin"],
  "nomination:vote": ["voter", "publisher", "host", "admin"],
  "nomination:moderate": ["publisher", "host", "admin"],
  "nomination:send": ["publisher", "host", "admin"],
  "settings:update": ["host", "admin"],
  "roles:update": ["host", "admin"],
};

export function hasPermission(roles: RoleName[], permission: Permission) {
  return map[permission].some((role) => roles.includes(role));
}

export function requirePermission(roles: RoleName[], permission: Permission) {
  if (!hasPermission(roles, permission)) {
    throw new Response("Forbidden", { status: 403 });
  }
}
