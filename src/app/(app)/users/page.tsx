import { TriangleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";

import { ForbiddenView } from "@/components/forbidden-view";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { USER_ROLES, USER_STATUSES, type User, type UserListFilters } from "@/modules/users/domain/user";
import { CreateUserDialog } from "@/modules/users/ui/create-user-dialog";
import { RETRY_LABEL, USERS_LOAD_ERROR_MESSAGE } from "@/modules/users/ui/messages";
import type { UserManagementActions } from "@/modules/users/ui/user-dialogs-state";
import { UsersFilters } from "@/modules/users/ui/users-filters";
import { USERS_PANEL_CLASS, UsersTable } from "@/modules/users/ui/users-table";
import { listUsers } from "@/server/container";
import { requireSignedInAdminOrNull } from "@/server/require-signed-in-user";

import {
  createUserAction,
  deactivateUserAction,
  reactivateUserAction,
  resetUserPasswordAction,
  updateUserAction,
} from "./actions";

const USERS_PATH = "/users";
const SKELETON_ROW_COUNT = 5;
/** Longer search texts are ignored: no real name or email is this long. */
const MAX_SEARCH_LENGTH = 200;

/**
 * The URL query of "Usuarios" (?search=&role=&status=). Values that are not
 * valid (unknown role, "status=foo", a repeated parameter) are ignored
 * instead of failing the page, so a hand-edited URL still shows a list.
 * The parameter names match the ones `UsersFilters` writes.
 */
const usersQuerySchema = z.object({
  search: z.string().trim().max(MAX_SEARCH_LENGTH).optional().catch(undefined),
  role: z.enum(USER_ROLES).optional().catch(undefined),
  status: z.enum([...USER_STATUSES, "must_change_password"]).optional().catch(undefined),
});

/** The Server Actions of user management (US-7–US-10); each one checks the admin session itself. */
const USER_MANAGEMENT_ACTIONS: UserManagementActions = {
  createUser: createUserAction,
  updateUser: updateUserAction,
  deactivateUser: deactivateUserAction,
  reactivateUser: reactivateUserAction,
  resetUserPassword: resetUserPasswordAction,
};

type UsersSearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Usuarios · WPP CRM",
};

/**
 * "Usuarios" (US-6, FR-013): the admin lists, searches and filters users.
 * An agent opening it by its address sees the "no permission" screen
 * (AC-3.3, BR-012) — no redirect.
 */
export default function UsersPage({ searchParams }: { searchParams: UsersSearchParams }): React.JSX.Element {
  return (
    <div className="flex w-full max-w-[1100px] flex-col gap-6">
      <Suspense fallback={<UsersPageSkeleton />}>
        <GuardedUsersList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/**
 * Request data (headers, search params) is read inside <Suspense> (Cache
 * Components). The page checks the session itself: the layout guard alone is
 * not enough, pages render independently of layouts.
 */
async function GuardedUsersList({ searchParams }: { searchParams: UsersSearchParams }): Promise<React.JSX.Element> {
  const filters = parseUsersQuery(await searchParams);
  const currentPath = buildUsersPath(filters);

  // A copy, because the headers from `headers()` are read-only.
  const requestHeaders = new Headers(await headers());
  // `null` = logged in but not an admin; logged-out users are redirected.
  const admin = await requireSignedInAdminOrNull({ requestHeaders, returnTo: currentPath });
  if (!admin) {
    return <ForbiddenView />;
  }

  let users: User[];
  try {
    users = await listUsers({ actor: admin, filters });
  } catch (error) {
    // Server log only, so the bug can be debugged; the user sees a generic text.
    console.error("Unexpected error while listing users:", error);
    return <UsersLoadError retryPath={currentPath} />;
  }

  return (
    <>
      <UsersHeader userCount={users.length} />
      <div className="flex flex-col gap-4">
        <UsersFilters filters={filters} />
        <UsersTable users={users} currentUserId={admin.id} actions={USER_MANAGEMENT_ACTIONS} />
      </div>
    </>
  );
}

/**
 * Title row with the "Crear usuario" button (US-7). The count line is left
 * out when the list could not be loaded (`userCount` undefined).
 */
function UsersHeader({ userCount }: { userCount?: number }): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-page font-semibold tracking-tight text-title">Usuarios</h1>
        {userCount !== undefined && <p className="text-meta text-muted-foreground">{formatUserCount(userCount)}</p>}
      </div>
      <CreateUserDialog action={USER_MANAGEMENT_ACTIONS.createUser} />
    </div>
  );
}

function UsersLoadError({ retryPath }: { retryPath: string }): React.JSX.Element {
  return (
    <>
      <UsersHeader />
      <div role="alert" className={`${USERS_PANEL_CLASS} flex flex-col items-center gap-3 px-6 py-14 text-center`}>
        <TriangleAlertIcon aria-hidden="true" className="size-8 text-muted-foreground" />
        <p className="text-muted-foreground">{USERS_LOAD_ERROR_MESSAGE}</p>
        <Link href={retryPath} className={buttonVariants({ variant: "outline", size: "sm" })}>
          {RETRY_LABEL}
        </Link>
      </div>
    </>
  );
}

/** "1 usuario" / "4 usuarios" — the number of users the current filters show. */
function formatUserCount(userCount: number): string {
  if (userCount === 1) {
    return "1 usuario";
  }
  return `${userCount} usuarios`;
}

/** Valid filters from the raw query; a repeated parameter (?role=a&role=b) counts as invalid. */
function parseUsersQuery(rawQuery: Record<string, string | string[] | undefined>): UserListFilters {
  const parsed = usersQuerySchema.parse(rawQuery);
  return {
    search: parsed.search || undefined,
    role: parsed.role,
    status: parsed.status,
  };
}

/** `/users` plus the applied filters, used to come back after login and to retry. */
function buildUsersPath(filters: UserListFilters): string {
  const query = new URLSearchParams();
  if (filters.search) {
    query.set("search", filters.search);
  }
  if (filters.role) {
    query.set("role", filters.role);
  }
  if (filters.status) {
    query.set("status", filters.status);
  }
  const queryString = query.toString();
  return queryString ? `${USERS_PATH}?${queryString}` : USERS_PATH;
}

function UsersPageSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-14 w-full max-w-2xl" />
        <div className={`${USERS_PANEL_CLASS} flex flex-col gap-3 p-4`}>
          {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
