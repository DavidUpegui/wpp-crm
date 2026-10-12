"use client";

import { useActionState, useRef } from "react";

import { FieldError } from "@/components/field-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFocusOnFormError } from "@/components/use-focus-on-form-error";
import { MIN_PASSWORD_LENGTH } from "@/modules/users/domain/password-policy";

import type { ChangePasswordFormAction, ChangePasswordFormState } from "./change-password-form-state";

const INITIAL_STATE: ChangePasswordFormState = { status: "idle" };

// Taller fields than the app default: the auth screens have room and are often used on phones.
// 16px on phones (below md) stops iOS from zooming in when a field gets focus.
const INPUT_CLASSES = "h-10 bg-card text-base md:text-body";

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
  const formRef = useRef<HTMLFormElement>(null);
  useFocusOnFormError(formRef, state);
  const newPasswordDescriptionIds = state.fieldErrors?.newPassword
    ? "new-password-hint new-password-error"
    : "new-password-hint";

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-5" noValidate>
      {state.message && (
        <Alert variant="destructive" tabIndex={-1}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="newPassword">Nueva contraseña</Label>
        <Input
          className={INPUT_CLASSES}
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(state.fieldErrors?.newPassword)}
          aria-describedby={newPasswordDescriptionIds}
        />
        <p id="new-password-hint" className="text-meta text-muted-foreground">
          Mínimo {MIN_PASSWORD_LENGTH} caracteres.
        </p>
        <FieldError id="new-password-error" message={state.fieldErrors?.newPassword} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="passwordConfirmation">Confirmar contraseña</Label>
        <Input
          className={INPUT_CLASSES}
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

      <Button type="submit" className="mt-1 h-10 w-full text-body" disabled={isPending}>
        {isPending ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
