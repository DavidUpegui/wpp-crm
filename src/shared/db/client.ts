import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/shared/config/env";
import * as schema from "./schema";

// Reuse the pool across hot reloads in dev to avoid exhausting connections.
const globalForDb = globalThis as unknown as { pgPool?: Pool };

export const pool = globalForDb.pgPool ?? new Pool({ connectionString: env.DATABASE_URL });

if (env.NODE_ENV !== "production") globalForDb.pgPool = pool;

export const db = drizzle(pool, { schema });
