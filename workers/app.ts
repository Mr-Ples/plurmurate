import { RouterContextProvider, createRequestHandler } from "react-router";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }

  export interface RouterContextProvider {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

export interface Env {
  APP_BASE_URL: string;
  SESSION_SECRET: string;
  DATABASE_PROVIDER: "sqlite" | "d1";
  STORAGE_PROVIDER: "local-r2" | "r2";
  PUBLISHING_WORKFLOW?: string;
  X_CLIENT_ID: string;
  X_CLIENT_SECRET: string;
  X_HOST_USER_ID: string;
  X_HOST_HANDLE: string;
  X_PUBLISHING_ACCESS_TOKEN: string;
  X_PUBLISHING_REFRESH_TOKEN: string;
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
}

declare global {
  interface CloudflareEnvironment extends Env {}
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    const context = new RouterContextProvider();
    context.cloudflare = { env, ctx };
    return requestHandler(request, context);
  },
} satisfies ExportedHandler<Env>;
