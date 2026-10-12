"use client";

import { useActionState } from "react";

import { FieldError } from "@/components/field-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { LoginFormAction, LoginFormState } from "./login-form-state";

const INITIAL_STATE: LoginFormState = { status: "idle" };

type LoginFormProps = {
  /** The login Server Action, passed in by the page (keeps `ui/` independent of `src/app/`). */
  action: LoginFormAction;
  /** Already-sanitized internal path to open after logging in (FR-009). */
  redirectTo: string;
};

/**
 * Email + password form of the login screen (US-1).
 *
 * The submit button is disabled while the request is in flight (spec §10).
 */
export function LoginForm({ action, redirectTo }: LoginFormProps): React.JSX.Element {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="redirectTo" value={redirectTo} />

      {state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          aria-invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
        />
        <FieldError id="email-error" message={state.fieldErrors?.email} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state.fieldErrors?.password)}
          aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
        />
        <FieldError id="password-error" message={state.fieldErrors?.password} />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Ingresando…" : "Iniciar sesión"}
      </Button>
    </form>
  );
}
