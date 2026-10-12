import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AppShell } from "@/components/app-shell/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { isAdmin } from "@/modules/users/domain/permissions";
import { getCurrentUser } from "@/server/container";
import { CURRENT_PATH_HEADER } from "@/shared/http/current-path-header";
import { safeRedirectPath } from "@/shared/http/safe-redirect-path";

import { logOutAction } from "./log-out-action";

const LOGIN_PATH = "/login";
const CHANGE_PASSWORD_PATH = "/change-password";

/**
 * Layout of every page after login (FR-006, FR-019).
 *
 * The session is read inside a <Suspense> boundary (Cache Components), never
 * at the layout's top level. The pages are rendered INSIDE the guarded shell
 * on purpose: nothing protected is sent until the session has been checked.
 */
export default function AppLayout({ children }: LayoutProps<"/">): React.JSX.Element {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <GuardedAppShell>{children}</GuardedAppShell>
    </Suspense>
  );
}

/**
 * The real server check (the proxy only looks at the cookie):
 * - no valid session (expired, forged, user inactive) → login, then back to
 *   the requested page (AC-3.1, AC-3.6);
 * - temporary password → change-password screen (BR-011, AC-4.1);
 * - otherwise → the shell with the user's name and role.
 */
async function GuardedAppShell({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  const requestHeaders = await headers();
  const currentUser = await getCurrentUser(requestHeaders);
  if (!currentUser) {
    redirect(buildLoginPath(requestHeaders.get(CURRENT_PATH_HEADER)));
  }
  if (currentUser.mustChangePassword) {
    redirect(CHANGE_PASSWORD_PATH);
  }

  return (
    <AppShell
      user={{ name: currentUser.name, role: currentUser.role }}
      canManageUsers={isAdmin(currentUser)}
      logOutAction={logOutAction}
    >
      {children}
    </AppShell>
  );
}

/** `/login?redirectTo=<requested page>`; the header is a hint, so it is sanitized first. */
function buildLoginPath(requestedPath: string | null): string {
  return `${LOGIN_PATH}?redirectTo=${encodeURIComponent(safeRedirectPath(requestedPath))}`;
}

function AppShellSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col" aria-hidden="true">
      <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="flex flex-col gap-3 px-4 py-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-5 w-64" />
      </div>
    </div>
  );
}
