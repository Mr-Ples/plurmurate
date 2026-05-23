import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./app/repositories/drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
  driver: "d1-http",
});
