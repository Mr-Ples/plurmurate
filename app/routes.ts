import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("auth/x/start", "routes/auth.x.start.tsx"),
  route("auth/x/callback", "routes/auth.x.callback.tsx"),
  route("logout", "routes/logout.tsx"),
  route("nominations/new", "routes/nominations.new.tsx"),
  route("nominations/:id", "routes/nominations.$id.tsx"),
  route("review", "routes/review.tsx"),
  route("settings", "routes/settings.tsx"),
  route("settings/roles", "routes/settings.roles.tsx"),
  route("settings/publishing", "routes/settings.publishing.tsx"),
  route("settings/criteria", "routes/settings.criteria.tsx"),
  route("me", "routes/me.tsx"),
  route("media/*", "routes/media.$.tsx"),
] satisfies RouteConfig;
