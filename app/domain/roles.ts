export const roleNames = ["spectator", "voter", "admin"] as const;
export type RoleName = (typeof roleNames)[number];

export type Permission =
  | "nomination:create"
  | "nomination:vote"
  | "nomination:moderate"
  | "nomination:send"
  | "settings:update"
  | "roles:update";
