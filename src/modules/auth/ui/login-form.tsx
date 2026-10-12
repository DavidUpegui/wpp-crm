"use client";

import { useActionState, useRef } from "react";

import { FieldError } from "@/components/field-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFocusOnFormError } from "@/components/use-focus-on-form-error";

import type { LoginFormAction, LoginFormState } from "./login-form-state";

const INITIAL_STATE: LoginFormState = { status: "idle" };

// Taller fields than the app default: the auth screens have room and are often used on phones.
// 16px on phones (below md) stops iOS from zooming in when a field gets focus.
const INPUT_CLASSES = "h-10 bg-card text-base md:text-body";

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
  const formRef = useRef<HTMLFormElement>(null);
  useFocusOnFormError(formRef, state);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="redirectTo" value={redirectTo} />

      {state.message && (
        <Alert variant="destructive" tabIndex={-1}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          className={INPUT_CLASSES}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          spellCheck={false}
          required
          defaultValue={state.email}
          aria-invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
        />
        <FieldError id="email-error" message={state.fieldErrors?.email} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          className={INPUT_CLASSES}
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

      <Button type="submit" className="mt-1 h-10 w-full text-body" disabled={isPending}>
        {isPending ? "Ingresando…" : "Iniciar sesión"}
      </Button>
    </form>
  );
}
