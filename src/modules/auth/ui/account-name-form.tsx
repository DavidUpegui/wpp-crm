"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/field-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFocusOnFormError } from "@/components/use-focus-on-form-error";

import type { AccountNameFormAction, AccountNameFormState } from "./account-form-state";

const INITIAL_STATE: AccountNameFormState = { status: "idle" };

type AccountNameFormProps = {
  /** The update-name Server Action, passed in by the page (keeps `ui/` independent of `src/app/`). */
  action: AccountNameFormAction;
  /** The user's current display name, shown as the field's starting value. */
  currentName: string;
};

/**
 * "Nombre" form of "Mi cuenta" (US-5, AC-5.1): the user changes their own
 * display name. On success a toast confirms it; the action refreshes the
 * page, so the app shell shows the new name too.
 *
 * The submit button is disabled while the request is in flight (spec §10).
 */
export function AccountNameForm({ action, currentName }: AccountNameFormProps): React.JSX.Element {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusOnFormError(formRef, state);

  useEffect(() => {
    if (state.status === "success" && state.message) {
      toast.success(state.message);
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-5" noValidate>
      {state.status === "error" && state.message && (
        <Alert variant="destructive" tabIndex={-1}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          defaultValue={currentName}
          required
          aria-invalid={Boolean(state.fieldErrors?.name)}
          aria-describedby={state.fieldErrors?.name ? "name-error" : undefined}
        />
        <FieldError id="name-error" message={state.fieldErrors?.name} />
      </div>

      <Button type="submit" disabled={isPending} className="mt-1 self-start">
        {isPending ? "Guardando…" : "Guardar nombre"}
      </Button>
    </form>
  );
}
