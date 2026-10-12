import "server-only";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.url(),

  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),

  META_APP_ID: z.string().min(1),
  META_APP_SECRET: z.string().min(1),
  META_GRAPH_API_VERSION: z.string().regex(/^v\d+\.\d+$/, "expected e.g. v23.0"),

  WHATSAPP_ACCESS_TOKEN: z.string().min(1),
  WHATSAPP_PHONE_NUMBER_ID: z.string().regex(/^\d+$/),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().regex(/^\d+$/),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().min(8),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    // Only variable names and messages — never values.
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables (check .env.local):\n${issues}`);
  }
  return result.data;
}

export const env = parseEnv();
