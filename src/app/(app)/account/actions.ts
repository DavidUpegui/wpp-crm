"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import type { AccountNameFormState, AccountPasswordFormState } from "@/modules/auth/ui/account-form-state";
import { getAuthErrorMessage, GENERIC_ERROR_MESSAGE } from "@/modules/auth/ui/messages";
import { PasswordPolicyError } from "@/modules/users/domain/errors";
import { changeOwnPassword, updateOwnName } from "@/server/container";
import { requireSignedInUser } from "@/server/require-signed-in-user";
import { AppError } from "@/shared/errors/app-error";

const ACCOUNT_PATH = "/account";

const NAME_UPDATED_MESSAGE = "Nombre actualizado";
// BR-013: the user's other sessions end, this one stays.
const PASSWORD_CHANGED_MESSAGE = "Contraseña actualizada. Se cerró la sesión en tus otros dispositivos.";

// Only form checks here. The name trimming and the password policy are
// checked by the use cases, so each rule lives in one place (BR-002).
const accountNameFormSchema = z.object({
  name: z.string().trim().min(1, getAuthErrorMessage("NAME_REQUIRED")),
});

const accountPasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, getAuthErrorMessage("PASSWORD_REQUIRED")),
    newPassword: z.string().min(1, getAuthErrorMessage("PASSWORD_REQUIRED")),
    passwordConfirmation: z.string(),
  })
  .refine((values) => values.passwordConfirmation === values.newPassword, {
    path: ["passwordConfirmation"],
    message: getAuthErrorMessage("PASSWORD_CONFIRMATION_MISMATCH"),
  });

/**
 * Server Action of the "Mi cuenta" name form (FR-011, AC-5.1).
 *
 * It checks the session itself (a layout guard is not enough for actions).
 * On success the client router is refreshed, so the app shell shows the new
 * name right away and on every later page load.
 */
export async function updateNameAction(
  _previousState: AccountNameFormState,
  formData: FormData,
): Promise<AccountNameFormState> {
  // A copy, because the headers from `headers()` are read-only.
  const requestHeaders = new Headers(await headers());
  const currentUser = await requireSignedInUser({ requestHeaders, returnTo: ACCOUNT_PATH });

  const parsed = accountNameFormSchema.safeParse({ name: formData.get("name") ?? "" });
  if (!parsed.success) {
    return { status: "error", fieldErrors: { name: z.flattenError(parsed.error).fieldErrors.name?.[0] } };
  }

  try {
    await updateOwnName({ currentUser, name: parsed.data.name });
  } catch (error) {
    return { status: "error", message: toErrorMessage(error) };
  }

  refresh();
  return { status: "success", message: NAME_UPDATED_MESSAGE };
}

/**
 * Server Action of the "Mi cuenta" password form (FR-011, FR-012, AC-5.2,
 * AC-5.3, AC-5.5).
 *
 * The current password is required. On success the user's sessions on other
 * devices end and this one stays (BR-013). On failure (wrong current
 * password, policy, same as current) nothing changes and the Spanish message
 * is returned.
 */
export async function changePasswordAction(
  _previousState: AccountPasswordFormState,
  formData: FormData,
): Promise<AccountPasswordFormState> {
  // A copy, because the headers from `headers()` are read-only.
  const requestHeaders = new Headers(await headers());
  const currentUser = await requireSignedInUser({ requestHeaders, returnTo: ACCOUNT_PATH });

  const parsed = accountPasswordFormSchema.safeParse({
    currentPassword: formData.get("currentPassword") ?? "",
    newPassword: formData.get("newPassword") ?? "",
    passwordConfirmation: formData.get("passwordConfirmation") ?? "",
  });
  if (!parsed.success) {
    return toPasswordFieldErrorState(parsed.error);
  }

  try {
    await changeOwnPassword({
      currentUser,
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
    });
  } catch (error) {
    return { status: "error", message: toErrorMessage(error) };
  }

  return { status: "success", message: PASSWORD_CHANGED_MESSAGE };
}

function toPasswordFieldErrorState(
  error: z.ZodError<z.infer<typeof accountPasswordFormSchema>>,
): AccountPasswordFormState {
  const fieldErrors = z.flattenError(error).fieldErrors;
  return {
    status: "error",
    fieldErrors: {
      currentPassword: fieldErrors.currentPassword?.[0],
      newPassword: fieldErrors.newPassword?.[0],
      passwordConfirmation: fieldErrors.passwordConfirmation?.[0],
    },
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof PasswordPolicyError) {
    return getAuthErrorMessage(error.code, error.reason);
  }
  if (error instanceof AppError) {
    return getAuthErrorMessage(error.code);
  }
  // Server log only, so the bug can be debugged; the user sees a generic text.
  console.error("Unexpected error in Mi cuenta:", error);
  return GENERIC_ERROR_MESSAGE;
}
