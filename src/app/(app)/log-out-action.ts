"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { logOut } from "@/server/container";

const LOGIN_PATH = "/login";

/**
 * Server Action of "Cerrar sesión" (US-2, FR-005).
 *
 * Ends the session (Better Auth deletes it and clears the cookie) and sends
 * the user to the login screen (AC-2.1). Allowed with a temporary password
 * too (BR-011). Protected pages are rendered per request, so after this the
 * back button or a refresh shows the login screen, not cached content (AC-2.2).
 */
export async function logOutAction(): Promise<void> {
  // A copy, because the headers from `headers()` are read-only.
  await logOut(new Headers(await headers()));
  redirect(LOGIN_PATH);
}
