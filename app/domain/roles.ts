export const roleNames = ["spectator", "voter", "publisher", "host", "admin"] as const;
export type RoleName = (typeof roleNames)[number];

export type Permission =
  | "nomination:create"
  | "nomination:vote"
  | "nomination:moderate"
  | "nomination:send"
  | "settings:update"
  | "roles:update";
