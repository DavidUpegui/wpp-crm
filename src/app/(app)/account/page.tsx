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
    <div className="flex w-full max-w-[720px] flex-col gap-8">
      {/* Page titles use Pine ink (plan §7b) through the title token. */}
      <h1 className="text-page font-semibold tracking-tight text-title">Mi cuenta</h1>

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
    <div className="flex flex-col gap-8">
      <dl className="flex flex-col gap-4 sm:flex-row sm:gap-12">
        <IdentityItem label="Correo electrónico" value={currentUser.email} />
        <IdentityItem label="Rol" value={getRoleLabel(currentUser.role)} />
      </dl>

      <AccountSection
        titleId="account-name-title"
        title="Nombre"
        helper="Es el nombre que ven tus compañeros en el CRM."
      >
        <AccountNameForm action={updateNameAction} currentName={currentUser.name} />
      </AccountSection>

      <AccountSection
        titleId="account-password-title"
        title="Contraseña"
        helper="Al cambiarla se cerrarán tus sesiones en otros dispositivos."
      >
        <AccountPasswordForm action={changePasswordAction} />
      </AccountSection>
    </div>
  );
}

/** One read-only fact about the account: muted label above its value. */
function IdentityItem({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-meta text-muted-foreground">{label}</dt>
      <dd className="text-body font-medium break-words">{value}</dd>
    </div>
  );
}

/** A Paper panel with a section title and a one-line explanation above its form. */
function AccountSection({
  titleId,
  title,
  helper,
  children,
}: {
  titleId: string;
  title: string;
  helper: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-5 rounded-xl border bg-card p-5 sm:p-6">
      <header className="flex flex-col gap-1">
        <h2 id={titleId} className="text-section font-semibold text-title">
          {title}
        </h2>
        <p className="text-body text-muted-foreground">{helper}</p>
      </header>
      <div className="w-full max-w-[420px]">{children}</div>
    </section>
  );
}

function AccountSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-8" aria-hidden="true">
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}
