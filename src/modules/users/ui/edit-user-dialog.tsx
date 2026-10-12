"use client";

import { useActionState, useId, useState } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/field-error";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { User } from "@/modules/users/domain/user";

import { RoleSelect } from "./create-user-dialog";
import { INITIAL_USER_DIALOG_STATE, type UserDialogAction, type UserDialogState } from "./user-dialogs-state";

/** Why the admin's own role select is disabled (AC-8.3, BR-009). */
const OWN_ROLE_LOCKED_MESSAGE = "No puedes cambiar tu propio rol";

/** The user fields the edit dialog needs (dates are left out on purpose). */
export type EditableUser = Pick<User, "id" | "name" | "email" | "role">;

type EditUserDialogProps = {
  user: EditableUser;
  /** True on the admin's own row: the role cannot be changed (AC-8.3). */
  isCurrentUser: boolean;
  /** The update-user Server Action, passed in by the page. */
  action: UserDialogAction;
};

/**
 * "Editar" button and dialog (US-8, FR-015): change a user's name and role.
 * The email is shown read-only (AC-8.5, BR-010). On the admin's own row the
 * role select is disabled with an explanation (AC-8.3); the server rejects
 * the change anyway. "Last admin" errors stay in the dialog (AC-8.4).
 */
export function EditUserDialog({ user, isCurrentUser, action }: EditUserDialogProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Editar</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
          <DialogDescription>Cambia el nombre o el rol de {user.name}.</DialogDescription>
        </DialogHeader>
        {/* The form unmounts when the dialog closes, so it reopens with the saved values. */}
        <EditUserForm user={user} isCurrentUser={isCurrentUser} action={action} onSuccess={() => setIsOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

type EditUserFormProps = EditUserDialogProps & { onSuccess: () => void };

function EditUserForm({ user, isCurrentUser, action, onSuccess }: EditUserFormProps): React.JSX.Element {
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
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="userId" value={user.id} />

      {state.status === "error" && state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${fieldId}-email`}>Correo electrónico</Label>
        {/* No `name`: the email is never sent, it cannot change (BR-010). */}
        <Input id={`${fieldId}-email`} type="email" value={user.email} readOnly disabled />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${fieldId}-name`}>Nombre</Label>
        <Input
          id={`${fieldId}-name`}
          name="name"
          type="text"
          autoComplete="off"
          defaultValue={user.name}
          required
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? `${fieldId}-name-error` : undefined}
        />
        <FieldError id={`${fieldId}-name-error`} message={fieldErrors.name} />
      </div>

      {isCurrentUser ? (
        <>
          {/* A disabled select sends nothing, so the unchanged role travels in a hidden input. */}
          <input type="hidden" name="role" value={user.role} />
          <RoleSelect
            id={`${fieldId}-role`}
            defaultRole={user.role}
            disabled
            helpText={OWN_ROLE_LOCKED_MESSAGE}
            errorMessage={fieldErrors.role}
          />
        </>
      ) : (
        <RoleSelect id={`${fieldId}-role`} name="role" defaultRole={user.role} errorMessage={fieldErrors.role} />
      )}

      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </DialogFooter>
    </form>
  );
}
