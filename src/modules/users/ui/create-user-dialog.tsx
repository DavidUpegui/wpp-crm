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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MIN_PASSWORD_LENGTH } from "@/modules/users/domain/password-policy";
import { USER_ROLES, type UserRole } from "@/modules/users/domain/user";

import { getRoleLabel } from "./role-labels";
import { INITIAL_USER_DIALOG_STATE, type UserDialogAction, type UserDialogState } from "./user-dialogs-state";

const ROLE_ITEMS: Record<string, string> = Object.fromEntries(USER_ROLES.map((role) => [role, getRoleLabel(role)]));

type CreateUserDialogProps = {
  /** The create-user Server Action, passed in by the page (keeps `ui/` independent of `src/app/`). */
  action: UserDialogAction;
};

/**
 * "Crear usuario" button and dialog (US-7, FR-014): name, email, role and a
 * temporary password. On success the dialog closes and a toast confirms it;
 * on error the dialog stays open with the message (e.g. duplicate email).
 *
 * The submit button is disabled while sending, so a double click sends one
 * request (AC-7.4; the database also rejects a duplicate email).
 */
export function CreateUserDialog({ action }: CreateUserDialogProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={<Button />}>Crear usuario</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear usuario</DialogTitle>
          <DialogDescription>
            El usuario deberá cambiar la contraseña temporal la primera vez que inicie sesión.
          </DialogDescription>
        </DialogHeader>
        {/* The form unmounts when the dialog closes, so it opens empty next time. */}
        <CreateUserForm action={action} onSuccess={() => setIsOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CreateUserForm({ action, onSuccess }: { action: UserDialogAction; onSuccess: () => void }): React.JSX.Element {
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
      {state.status === "error" && state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${fieldId}-name`}>Nombre</Label>
        <Input
          id={`${fieldId}-name`}
          name="name"
          type="text"
          autoComplete="off"
          required
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? `${fieldId}-name-error` : undefined}
        />
        <FieldError id={`${fieldId}-name-error`} message={fieldErrors.name} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${fieldId}-email`}>Correo electrónico</Label>
        <Input
          id={`${fieldId}-email`}
          name="email"
          type="email"
          autoComplete="off"
          required
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? `${fieldId}-email-error` : undefined}
        />
        <FieldError id={`${fieldId}-email-error`} message={fieldErrors.email} />
      </div>

      <RoleSelect id={`${fieldId}-role`} name="role" errorMessage={fieldErrors.role} />

      <TemporaryPasswordField id={`${fieldId}-password`} errorMessage={fieldErrors.temporaryPassword} />

      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando…" : "Crear"}
        </Button>
      </DialogFooter>
    </form>
  );
}

type RoleSelectProps = {
  id: string;
  /** Form field name; leave it out when another input sends the role (disabled select). */
  name?: string;
  defaultRole?: UserRole;
  disabled?: boolean;
  errorMessage?: string;
  /** Extra text under the select, e.g. why it is disabled. */
  helpText?: string;
};

/**
 * "Rol" dropdown (Administrador / Agente) shared by the create and edit
 * dialogs. With no default it starts empty, so a missing role is reported
 * (AC-7.3).
 */
export function RoleSelect({
  id,
  name,
  defaultRole,
  disabled = false,
  errorMessage,
  helpText,
}: RoleSelectProps): React.JSX.Element {
  const describedBy = [errorMessage ? `${id}-error` : null, helpText ? `${id}-help` : null].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>Rol</Label>
      <Select items={ROLE_ITEMS} name={name} defaultValue={defaultRole ?? null} disabled={disabled}>
        <SelectTrigger
          id={id}
          className="w-full"
          aria-invalid={Boolean(errorMessage)}
          aria-describedby={describedBy || undefined}
        >
          <SelectValue placeholder="Selecciona un rol" />
        </SelectTrigger>
        <SelectContent>
          {USER_ROLES.map((role) => (
            <SelectItem key={role} value={role}>
              {ROLE_ITEMS[role]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {helpText && (
        <p id={`${id}-help`} className="text-sm text-muted-foreground">
          {helpText}
        </p>
      )}
      <FieldError id={`${id}-error`} message={errorMessage} />
    </div>
  );
}

/**
 * "Contraseña temporal" field shared by the create and reset-password
 * dialogs, with the minimum length as a hint (BR-002).
 */
export function TemporaryPasswordField({ id, errorMessage }: { id: string; errorMessage?: string }): React.JSX.Element {
  const describedBy = errorMessage ? `${id}-help ${id}-error` : `${id}-help`;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>Contraseña temporal</Label>
      <Input
        id={id}
        name="temporaryPassword"
        type="password"
        autoComplete="new-password"
        required
        aria-invalid={Boolean(errorMessage)}
        aria-describedby={describedBy}
      />
      <p id={`${id}-help`} className="text-sm text-muted-foreground">
        Mínimo {MIN_PASSWORD_LENGTH} caracteres.
      </p>
      <FieldError id={`${id}-error`} message={errorMessage} />
    </div>
  );
}
