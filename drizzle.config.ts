import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set (check .env.local)");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/shared/db/schema",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL },
  strict: true,
  verbose: true,
});
