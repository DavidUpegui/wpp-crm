import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { LoginForm } from "@/modules/auth/ui/login-form";
import { safeRedirectPath } from "@/shared/http/safe-redirect-path";

import { logInAction } from "./actions";

export const metadata: Metadata = {
  title: "Iniciar sesión · WPP CRM",
};

/**
 * Login screen (US-1). `?redirectTo=` is the page the user wanted before
 * being sent here; only internal paths are kept (FR-009, no open redirect).
 */
export default function LoginPage({ searchParams }: PageProps<"/login">): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Iniciar sesión</h1>
        <p className="text-sm text-muted-foreground">Ingresa con tu correo y contraseña.</p>
      </header>

      {/* With Cache Components, request data (searchParams) is read inside a
          <Suspense> boundary; the title above stays in the static shell. */}
      <Suspense fallback={<LoginFormSkeleton />}>
        <LoginFormWithRedirect searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function LoginFormWithRedirect({
  searchParams,
}: Pick<PageProps<"/login">, "searchParams">): Promise<React.JSX.Element> {
  const { redirectTo } = await searchParams;
  const requestedPath = typeof redirectTo === "string" ? redirectTo : undefined;
  return <LoginForm action={logInAction} redirectTo={safeRedirectPath(requestedPath)} />;
}

function LoginFormSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
