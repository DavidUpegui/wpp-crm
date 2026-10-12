import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/shared/db/client";

export async function GET() {
  // Opt out of prerendering: this must run at request time (Cache Components).
  await connection();

  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok", db: "up" });
  } catch {
    return Response.json({ status: "error", db: "down" }, { status: 503 });
  }
}
