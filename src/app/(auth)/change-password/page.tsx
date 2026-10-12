import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { ChangePasswordForm } from "@/modules/auth/ui/change-password-form";
import { getCurrentUser } from "@/server/container";

import { changePasswordAction } from "./actions";

const HOME_PATH = "/inbox";
const LOGIN_PATH = "/login";

export const metadata: Metadata = {
  title: "Cambia tu contraseña · WPP CRM",
};

/**
 * Forced change-password screen (US-4, FR-010): the only page a user with a
 * temporary password may open (BR-011). The voluntary change lives in
 * "Mi cuenta" (US-5), so users without a pending change are sent home.
 */
export default function ChangePasswordPage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-page font-semibold tracking-tight text-title">Cambia tu contraseña</h1>
        <p className="text-body text-muted-foreground">
          Tu contraseña es temporal. Elige una nueva contraseña antes de continuar.
        </p>
      </header>

      {/* With Cache Components, request data (headers) is read inside a
          <Suspense> boundary; the title above stays in the static shell. */}
      <Suspense fallback={<ChangePasswordFormSkeleton />}>
        <GuardedChangePasswordForm />
      </Suspense>
    </div>
  );
}

/**
 * Real server check (the proxy does not run on this path): only a logged-in
 * user with a pending password change sees the form.
 */
async function GuardedChangePasswordForm(): Promise<React.JSX.Element> {
  const currentUser = await getCurrentUser(await headers());
  if (!currentUser) {
    redirect(LOGIN_PATH);
  }
  if (!currentUser.mustChangePassword) {
    redirect(HOME_PATH);
  }
  return <ChangePasswordForm action={changePasswordAction} />;
}

function ChangePasswordFormSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
