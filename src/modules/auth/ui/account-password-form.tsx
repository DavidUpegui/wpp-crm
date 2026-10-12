"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/field-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_PASSWORD_LENGTH } from "@/modules/users/domain/password-policy";

import type { AccountPasswordFormAction, AccountPasswordFormState } from "./account-form-state";

const INITIAL_STATE: AccountPasswordFormState = { status: "idle" };

type AccountPasswordFormProps = {
  /** The change-password Server Action, passed in by the page (keeps `ui/` independent of `src/app/`). */
  action: AccountPasswordFormAction;
};

/**
 * "Contraseña" form of "Mi cuenta" (US-5, AC-5.2, AC-5.3): current password,
 * new password and confirmation. On success the fields are cleared and the
 * message says the other devices were logged out (BR-013).
 *
 * The submit button is disabled while the request is in flight (spec §10).
 */
export function AccountPasswordForm({ action }: AccountPasswordFormProps): React.JSX.Element {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const newPasswordDescriptionIds = state.fieldErrors?.newPassword
    ? "account-new-password-hint account-new-password-error"
    : "account-new-password-hint";

  useEffect(() => {
    if (state.status === "success" && state.message) {
      // React already resets the fields after a form action; this makes sure
      // no password stays in the inputs even if that behavior changes.
      formRef.current?.reset();
      toast.success(state.message);
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="currentPassword">Contraseña actual</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state.fieldErrors?.currentPassword)}
          aria-describedby={state.fieldErrors?.currentPassword ? "current-password-error" : undefined}
        />
        <FieldError id="current-password-error" message={state.fieldErrors?.currentPassword} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="newPassword">Nueva contraseña</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(state.fieldErrors?.newPassword)}
          aria-describedby={newPasswordDescriptionIds}
        />
        <p id="account-new-password-hint" className="text-sm text-muted-foreground">
          Mínimo {MIN_PASSWORD_LENGTH} caracteres.
        </p>
        <FieldError id="account-new-password-error" message={state.fieldErrors?.newPassword} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="passwordConfirmation">Confirmar contraseña</Label>
        <Input
          id="passwordConfirmation"
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(state.fieldErrors?.passwordConfirmation)}
          aria-describedby={
            state.fieldErrors?.passwordConfirmation ? "account-password-confirmation-error" : undefined
          }
        />
        <FieldError id="account-password-confirmation-error" message={state.fieldErrors?.passwordConfirmation} />
      </div>

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Guardando…" : "Cambiar contraseña"}
      </Button>
    </form>
  );
}

/** Success or whole-form error message above the fields. */
function FormMessage({ state }: { state: AccountPasswordFormState }): React.JSX.Element | null {
  if (!state.message) {
    return null;
  }
  if (state.status === "success") {
    return (
      <Alert role="status">
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert variant="destructive">
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}
