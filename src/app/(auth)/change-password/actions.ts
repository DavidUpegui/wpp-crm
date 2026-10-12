"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { UnauthenticatedError } from "@/modules/auth/domain/errors";
import type { ChangePasswordFormState } from "@/modules/auth/ui/change-password-form-state";
import { getAuthErrorMessage, GENERIC_ERROR_MESSAGE } from "@/modules/auth/ui/messages";
import { PasswordPolicyError } from "@/modules/users/domain/errors";
import { changeOwnPassword, requireCurrentUser } from "@/server/container";
import { AppError } from "@/shared/errors/app-error";

const HOME_PATH = "/inbox";
const LOGIN_PATH = "/login";

// Only form checks here. The password policy (length) is checked by the use
// case, so the rule lives in one place (BR-002).
const changePasswordFormSchema = z
  .object({
    newPassword: z.string().min(1, getAuthErrorMessage("PASSWORD_REQUIRED")),
    passwordConfirmation: z.string(),
  })
  .refine((values) => values.passwordConfirmation === values.newPassword, {
    path: ["passwordConfirmation"],
    message: getAuthErrorMessage("PASSWORD_CONFIRMATION_MISMATCH"),
  });

/**
 * Server Action of the forced change-password form (US-4, FR-010).
 *
 * The use case decides it is a forced change from the user's stored state, so
 * no current password is sent. On success the user lands on the app home
 * (AC-4.2) and the current session stays valid (BR-013). On failure it returns
 * the Spanish message for the policy, same-as-temporary or mismatch error
 * (AC-4.3); nothing is saved in that case.
 */
export async function changePasswordAction(
  _previousState: ChangePasswordFormState,
  formData: FormData,
): Promise<ChangePasswordFormState> {
  const parsed = changePasswordFormSchema.safeParse({
    newPassword: formData.get("newPassword") ?? "",
    passwordConfirmation: formData.get("passwordConfirmation") ?? "",
  });
  if (!parsed.success) {
    return toFieldErrorState(parsed.error);
  }

  let isLoggedOut = false;
  try {
    // A copy, because the headers from `headers()` are read-only.
    const requestHeaders = new Headers(await headers());
    const currentUser = await requireCurrentUser(requestHeaders, { allowPendingPasswordChange: true });
    await changeOwnPassword({ currentUser, newPassword: parsed.data.newPassword });
  } catch (error) {
    if (!(error instanceof UnauthenticatedError)) {
      return { status: "error", message: toErrorMessage(error) };
    }
    isLoggedOut = true;
  }

  // Outside the try/catch: `redirect()` works by throwing, and catching it
  // would turn a successful change into an error message.
  if (isLoggedOut) {
    redirect(LOGIN_PATH);
  }
  redirect(HOME_PATH);
}

function toFieldErrorState(
  error: z.ZodError<z.infer<typeof changePasswordFormSchema>>,
): ChangePasswordFormState {
  const fieldErrors = z.flattenError(error).fieldErrors;
  return {
    status: "error",
    fieldErrors: {
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
  console.error("Unexpected error while changing the password:", error);
  return GENERIC_ERROR_MESSAGE;
}
