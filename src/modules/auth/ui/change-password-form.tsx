"use client";

import { useActionState } from "react";

import { FieldError } from "@/components/field-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_PASSWORD_LENGTH } from "@/modules/users/domain/password-policy";

import type { ChangePasswordFormAction, ChangePasswordFormState } from "./change-password-form-state";

const INITIAL_STATE: ChangePasswordFormState = { status: "idle" };

type ChangePasswordFormProps = {
  /** The change-password Server Action, passed in by the page (keeps `ui/` independent of `src/app/`). */
  action: ChangePasswordFormAction;
};

/**
 * New password + confirmation form of the forced change-password screen
 * (US-4, FR-010). The temporary password is not asked again (plan §11).
 *
 * The submit button is disabled while the request is in flight (spec §10).
 */
export function ChangePasswordForm({ action }: ChangePasswordFormProps): React.JSX.Element {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const newPasswordDescriptionIds = state.fieldErrors?.newPassword
    ? "new-password-hint new-password-error"
    : "new-password-hint";

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

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
        <p id="new-password-hint" className="text-sm text-muted-foreground">
          Mínimo {MIN_PASSWORD_LENGTH} caracteres.
        </p>
        <FieldError id="new-password-error" message={state.fieldErrors?.newPassword} />
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
            state.fieldErrors?.passwordConfirmation ? "password-confirmation-error" : undefined
          }
        />
        <FieldError id="password-confirmation-error" message={state.fieldErrors?.passwordConfirmation} />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
