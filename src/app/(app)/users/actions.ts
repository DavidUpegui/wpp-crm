"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import type { CurrentUser } from "@/modules/auth/domain/current-user";
import { PasswordPolicyError } from "@/modules/users/domain/errors";
import { USER_ROLES } from "@/modules/users/domain/user";
import { GENERIC_ERROR_MESSAGE, getUserErrorMessage } from "@/modules/users/ui/messages";
import type { UserDialogFieldErrors, UserDialogState } from "@/modules/users/ui/user-dialogs-state";
import { createUser, deactivateUser, reactivateUser, resetUserPassword, updateUser } from "@/server/container";
import { requireSignedInAdminOrNull } from "@/server/require-signed-in-user";
import { AppError } from "@/shared/errors/app-error";

const USERS_PATH = "/users";

const USER_CREATED_MESSAGE = "Usuario creado";
const USER_UPDATED_MESSAGE = "Usuario actualizado";
const USER_DEACTIVATED_MESSAGE = "Usuario desactivado";
const USER_REACTIVATED_MESSAGE = "Usuario reactivado";
const PASSWORD_RESET_MESSAGE = "Contraseña restablecida";

// Form-only validation texts (not given by the spec).
const INVALID_EMAIL_MESSAGE = "Ingresa un correo válido";
const ROLE_REQUIRED_MESSAGE = "Selecciona un rol";
const TEMPORARY_PASSWORD_REQUIRED_MESSAGE = "Ingresa una contraseña temporal";

/** Returned when a logged-in non-admin calls an action directly (BR-012). */
const FORBIDDEN_STATE: UserDialogState = { status: "error", message: getUserErrorMessage("FORBIDDEN") };

/** Errors whose message belongs under one field instead of at the top of the dialog. */
const FIELD_BY_ERROR_CODE: Record<string, keyof UserDialogFieldErrors> = {
  NAME_REQUIRED: "name",
  EMAIL_ALREADY_IN_USE: "email",
  PASSWORD_POLICY: "temporaryPassword",
};

// Only form checks here. Name trimming, the password policy, the duplicate
// email and the admin rules are checked by the use cases, so each rule lives
// in one place.
const nameSchema = z.string().trim().min(1, getUserErrorMessage("NAME_REQUIRED"));
const roleSchema = z.enum(USER_ROLES, { error: ROLE_REQUIRED_MESSAGE });
const temporaryPasswordSchema = z.string().min(1, TEMPORARY_PASSWORD_REQUIRED_MESSAGE);
const userIdSchema = z.string().min(1);

const createUserFormSchema = z.object({
  name: nameSchema,
  email: z.string().trim().pipe(z.email({ error: INVALID_EMAIL_MESSAGE })),
  role: roleSchema,
  temporaryPassword: temporaryPasswordSchema,
});

// No email field: the email can never change (BR-010, AC-8.5).
const updateUserFormSchema = z.object({ userId: userIdSchema, name: nameSchema, role: roleSchema });

const resetPasswordFormSchema = z.object({ userId: userIdSchema, temporaryPassword: temporaryPasswordSchema });

const toggleStatusFormSchema = z.object({ userId: userIdSchema });

/**
 * "Crear usuario" (US-7, FR-014). A double submit creates one user only:
 * the button is disabled while sending and the database rejects a second
 * user with the same email (AC-7.4).
 */
export async function createUserAction(_previousState: UserDialogState, formData: FormData): Promise<UserDialogState> {
  const actor = await requireAdminOrNull();
  if (!actor) {
    return FORBIDDEN_STATE;
  }

  const parsed = createUserFormSchema.safeParse(readFormFields(formData, ["name", "email", "role", "temporaryPassword"]));
  if (!parsed.success) {
    return toFieldErrorState(parsed.error);
  }

  return runUserManagementChange(() => createUser({ actor, ...parsed.data }), USER_CREATED_MESSAGE);
}

/** "Editar" (US-8, FR-015): name and role. The use case rejects an own-role change and demoting the last admin. */
export async function updateUserAction(_previousState: UserDialogState, formData: FormData): Promise<UserDialogState> {
  const actor = await requireAdminOrNull();
  if (!actor) {
    return FORBIDDEN_STATE;
  }

  const parsed = updateUserFormSchema.safeParse(readFormFields(formData, ["userId", "name", "role"]));
  if (!parsed.success) {
    return toFieldErrorState(parsed.error);
  }

  return runUserManagementChange(() => updateUser({ actor, ...parsed.data }), USER_UPDATED_MESSAGE);
}

/** "Desactivar" (US-9, FR-016): all the user's sessions end immediately (BR-006). */
export async function deactivateUserAction(
  _previousState: UserDialogState,
  formData: FormData,
): Promise<UserDialogState> {
  const actor = await requireAdminOrNull();
  if (!actor) {
    return FORBIDDEN_STATE;
  }

  const parsed = toggleStatusFormSchema.safeParse(readFormFields(formData, ["userId"]));
  if (!parsed.success) {
    return toFieldErrorState(parsed.error);
  }

  return runUserManagementChange(() => deactivateUser({ actor, ...parsed.data }), USER_DEACTIVATED_MESSAGE);
}

/** "Reactivar" (US-9, AC-9.2): the user logs in again with their existing password. */
export async function reactivateUserAction(
  _previousState: UserDialogState,
  formData: FormData,
): Promise<UserDialogState> {
  const actor = await requireAdminOrNull();
  if (!actor) {
    return FORBIDDEN_STATE;
  }

  const parsed = toggleStatusFormSchema.safeParse(readFormFields(formData, ["userId"]));
  if (!parsed.success) {
    return toFieldErrorState(parsed.error);
  }

  return runUserManagementChange(() => reactivateUser({ actor, ...parsed.data }), USER_REACTIVATED_MESSAGE);
}

/** "Restablecer contraseña" (US-10, FR-017): new temporary password, all the user's sessions end (BR-006). */
export async function resetUserPasswordAction(
  _previousState: UserDialogState,
  formData: FormData,
): Promise<UserDialogState> {
  const actor = await requireAdminOrNull();
  if (!actor) {
    return FORBIDDEN_STATE;
  }

  const parsed = resetPasswordFormSchema.safeParse(readFormFields(formData, ["userId", "temporaryPassword"]));
  if (!parsed.success) {
    return toFieldErrorState(parsed.error);
  }

  return runUserManagementChange(() => resetUserPassword({ actor, ...parsed.data }), PASSWORD_RESET_MESSAGE);
}

/**
 * Every action checks the session itself, FIRST (a layout or page guard is
 * not enough: actions can be called directly). Returns `null` when the user
 * is logged in but not an admin (BR-012); logged-out and temporary-password
 * users are redirected.
 */
async function requireAdminOrNull(): Promise<CurrentUser | null> {
  // A copy, because the headers from `headers()` are read-only.
  const requestHeaders = new Headers(await headers());
  return requireSignedInAdminOrNull({ requestHeaders, returnTo: USERS_PATH });
}

/** The named fields of the form as strings (a missing field becomes ""), ready for Zod. */
function readFormFields(formData: FormData, fieldNames: string[]): Record<string, string> {
  return Object.fromEntries(
    fieldNames.map((fieldName) => {
      const value = formData.get(fieldName);
      return [fieldName, typeof value === "string" ? value : ""];
    }),
  );
}

/**
 * Runs one use case. On success the page is refreshed (so the table shows
 * the change) and the success text is returned; on failure nothing changed
 * and the Spanish error is returned.
 */
async function runUserManagementChange(change: () => Promise<unknown>, successMessage: string): Promise<UserDialogState> {
  try {
    await change();
  } catch (error) {
    return toErrorState(error);
  }

  refresh();
  return { status: "success", message: successMessage };
}

function toFieldErrorState(error: z.ZodError): UserDialogState {
  const fieldErrors = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  return {
    status: "error",
    fieldErrors: {
      name: fieldErrors.name?.[0],
      email: fieldErrors.email?.[0],
      role: fieldErrors.role?.[0],
      temporaryPassword: fieldErrors.temporaryPassword?.[0],
    },
    // A bad hidden `userId` is not a field the admin can fix.
    message: fieldErrors.userId ? GENERIC_ERROR_MESSAGE : undefined,
  };
}

function toErrorState(error: unknown): UserDialogState {
  if (!(error instanceof AppError)) {
    // Server log only, so the bug can be debugged; the user sees a generic text.
    console.error("Unexpected error in user management:", error);
    return { status: "error", message: GENERIC_ERROR_MESSAGE };
  }

  const reason = error instanceof PasswordPolicyError ? error.reason : undefined;
  const message = getUserErrorMessage(error.code, reason);
  const field = FIELD_BY_ERROR_CODE[error.code];
  if (field) {
    return { status: "error", fieldErrors: { [field]: message } };
  }
  return { status: "error", message };
}
