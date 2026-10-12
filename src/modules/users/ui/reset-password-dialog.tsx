"use client";

import { useActionState, useId, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { User } from "@/modules/users/domain/user";

import { TemporaryPasswordField } from "./create-user-dialog";
import { INITIAL_USER_DIALOG_STATE, type UserDialogAction, type UserDialogState } from "./user-dialogs-state";

type ResetPasswordDialogProps = {
  user: Pick<User, "id" | "name">;
  /** The reset-password Server Action, passed in by the page. */
  action: UserDialogAction;
};

/**
 * "Restablecer contraseña" button and dialog (US-10, FR-017): the admin sets
 * a new temporary password for ANOTHER user (the table never offers it on
 * the admin's own row, AC-10.2). All the user's sessions end and they must
 * change the password at their next login (AC-10.1, BR-006).
 */
export function ResetPasswordDialog({ user, action }: ResetPasswordDialogProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Restablecer contraseña</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restablecer contraseña de {user.name}</DialogTitle>
          <DialogDescription>
            Se cerrarán todas sus sesiones y deberá cambiar esta contraseña temporal la próxima vez que inicie
            sesión.
          </DialogDescription>
        </DialogHeader>
        {/* The form unmounts when the dialog closes, so the password is never kept. */}
        <ResetPasswordForm user={user} action={action} onSuccess={() => setIsOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

type ResetPasswordFormProps = ResetPasswordDialogProps & { onSuccess: () => void };

function ResetPasswordForm({ user, action, onSuccess }: ResetPasswordFormProps): React.JSX.Element {
  const fieldId = useId();
  const [state, formAction, isPending] = useActionState(
    async (previousState: UserDialogState, formData: FormData): Promise<UserDialogState> => {
      const nextState = await action(previousState, formData);
      if (nextState.status === "success") {
        toast.success(nextState.message);
        onSuccess();
      }
      return nextState;
    },
    INITIAL_USER_DIALOG_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="userId" value={user.id} />

      {state.status === "error" && state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <TemporaryPasswordField id={`${fieldId}-password`} errorMessage={state.fieldErrors?.temporaryPassword} />

      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando…" : "Restablecer contraseña"}
        </Button>
      </DialogFooter>
    </form>
  );
}
