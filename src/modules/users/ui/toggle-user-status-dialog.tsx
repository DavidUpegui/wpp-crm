"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { User } from "@/modules/users/domain/user";

import { INITIAL_USER_DIALOG_STATE, type UserDialogAction, type UserDialogState } from "./user-dialogs-state";

type ToggleUserStatusDialogProps = {
  user: Pick<User, "id" | "name" | "status">;
  /** The deactivate action for an active user, the reactivate action for an inactive one (passed in by the page). */
  action: UserDialogAction;
};

/** The texts of each direction: an active user is deactivated, an inactive one reactivated. */
function getDialogTexts(user: ToggleUserStatusDialogProps["user"]): {
  buttonLabel: string;
  title: string;
  description: string;
} {
  if (user.status === "active") {
    return {
      buttonLabel: "Desactivar",
      title: `¿Desactivar a ${user.name}?`,
      description:
        "Se cerrarán todas sus sesiones de inmediato y no podrá iniciar sesión hasta que lo reactives. Su historial se conserva.",
    };
  }
  return {
    buttonLabel: "Reactivar",
    title: `¿Reactivar a ${user.name}?`,
    description: "Podrá volver a iniciar sesión con su contraseña actual.",
  };
}

/**
 * "Desactivar" / "Reactivar" button with a confirmation naming the user
 * (US-9, AC-9.5). Nothing changes until the admin confirms. The table never
 * offers "Desactivar" on the admin's own row (AC-9.3); "last admin" errors
 * stay in the dialog (AC-9.4).
 */
export function ToggleUserStatusDialog({ user, action }: ToggleUserStatusDialogProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const texts = getDialogTexts(user);
  const buttonVariant = user.status === "active" ? "destructive" : "outline";

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger render={<Button variant={buttonVariant} size="sm" />}>{texts.buttonLabel}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{texts.title}</AlertDialogTitle>
          <AlertDialogDescription>{texts.description}</AlertDialogDescription>
        </AlertDialogHeader>
        {/* The form unmounts when the dialog closes, so an old error is not shown again. */}
        <ToggleUserStatusForm
          userId={user.id}
          confirmLabel={texts.buttonLabel}
          action={action}
          onSuccess={() => setIsOpen(false)}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}

type ToggleUserStatusFormProps = {
  userId: string;
  confirmLabel: string;
  action: UserDialogAction;
  onSuccess: () => void;
};

function ToggleUserStatusForm({ userId, confirmLabel, action, onSuccess }: ToggleUserStatusFormProps): React.JSX.Element {
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
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="userId" value={userId} />

      {state.status === "error" && state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <AlertDialogFooter>
        <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
        <AlertDialogAction type="submit" disabled={isPending}>
          {isPending ? "Guardando…" : confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </form>
  );
}
