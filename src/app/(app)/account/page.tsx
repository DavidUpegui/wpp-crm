import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { AccountNameForm } from "@/modules/auth/ui/account-name-form";
import { AccountPasswordForm } from "@/modules/auth/ui/account-password-form";
import { getRoleLabel } from "@/modules/users/ui/role-labels";
import { requireSignedInUser } from "@/server/require-signed-in-user";

import { changePasswordAction, updateNameAction } from "./actions";

const ACCOUNT_PATH = "/account";

export const metadata: Metadata = {
  title: "Mi cuenta · WPP CRM",
};

/**
 * "Mi cuenta" (US-5, FR-011): the logged-in user sees their email and role
 * (read-only, AC-5.4) and changes their own name and password.
 */
export default function AccountPage(): React.JSX.Element {
  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Mi cuenta</h1>

      {/* With Cache Components, request data (headers) is read inside a
          <Suspense> boundary; the title above stays in the static shell. */}
      <Suspense fallback={<AccountSkeleton />}>
        <GuardedAccountDetails />
      </Suspense>
    </div>
  );
}

/**
 * The page checks the session itself (the layout guard alone is not enough:
 * pages render independently of layouts).
 */
async function GuardedAccountDetails(): Promise<React.JSX.Element> {
  // A copy, because the headers from `headers()` are read-only.
  const requestHeaders = new Headers(await headers());
  const currentUser = await requireSignedInUser({ requestHeaders, returnTo: ACCOUNT_PATH });

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Correo electrónico</dt>
        <dd>{currentUser.email}</dd>
        <dt className="text-muted-foreground">Rol</dt>
        <dd>{getRoleLabel(currentUser.role)}</dd>
      </dl>

      <AccountCard title="Nombre">
        <AccountNameForm action={updateNameAction} currentName={currentUser.name} />
      </AccountCard>

      <AccountCard title="Contraseña">
        <AccountPasswordForm action={changePasswordAction} />
      </AccountCard>
    </div>
  );
}

function AccountCard({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function AccountSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-36 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
