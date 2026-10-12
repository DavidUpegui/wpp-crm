"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { LogInResult } from "@/modules/auth/application/log-in";
import type { LoginFormState } from "@/modules/auth/ui/login-form-state";
import { getAuthErrorMessage, GENERIC_ERROR_MESSAGE } from "@/modules/auth/ui/messages";
import { logIn } from "@/server/container";
import { AppError } from "@/shared/errors/app-error";
import { getClientIp } from "@/shared/http/get-client-ip";
import { safeRedirectPath } from "@/shared/http/safe-redirect-path";

const CHANGE_PASSWORD_PATH = "/change-password";

// Only checks that both fields are present. The email FORMAT is deliberately
// not validated: a malformed email must get the same generic "wrong
// credentials" message as a wrong password (BR-003).
const logInFormSchema = z.object({
  email: z.string().trim().min(1, getAuthErrorMessage("EMAIL_REQUIRED")),
  password: z.string().min(1, getAuthErrorMessage("PASSWORD_REQUIRED")),
  redirectTo: z.string(),
});

/**
 * Server Action of the login form (US-1).
 *
 * On success Better Auth sets the session cookie (through `nextCookies()`)
 * and the user goes to the change-password screen when the password is
 * temporary (AC-1.4), else to `redirectTo` when it is an internal path
 * (FR-009), else to `/inbox`. On failure it returns the Spanish message for
 * the error (AC-1.2, AC-1.3, AC-1.5).
 */
export async function logInAction(
  _previousState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const parsed = logInFormSchema.safeParse({
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
    redirectTo: formData.get("redirectTo") ?? "",
  });
  if (!parsed.success) {
    return toFieldErrorState(parsed.error, formData);
  }

  const { email, password, redirectTo } = parsed.data;
  let result: LogInResult;
  try {
    // A copy, because the headers from `headers()` are read-only.
    const requestHeaders = new Headers(await headers());
    result = await logIn({
      email,
      password,
      ipAddress: getClientIp(requestHeaders),
      requestHeaders,
    });
  } catch (error) {
    return { status: "error", message: toErrorMessage(error), email };
  }

  // Outside the try/catch: `redirect()` works by throwing, and catching it
  // would turn a successful login into an error message.
  if (result.mustChangePassword) {
    redirect(CHANGE_PASSWORD_PATH);
  }
  // The hidden field can be edited by the user, so it is checked again here.
  redirect(safeRedirectPath(redirectTo));
}

function toFieldErrorState(
  error: z.ZodError<z.infer<typeof logInFormSchema>>,
  formData: FormData,
): LoginFormState {
  const fieldErrors = z.flattenError(error).fieldErrors;
  const typedEmail = formData.get("email");
  return {
    status: "error",
    fieldErrors: {
      email: fieldErrors.email?.[0],
      password: fieldErrors.password?.[0],
    },
    email: typeof typedEmail === "string" ? typedEmail : undefined,
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return getAuthErrorMessage(error.code);
  }
  // Server log only, so the bug can be debugged; the user sees a generic text.
  console.error("Unexpected error while logging in:", error);
  return GENERIC_ERROR_MESSAGE;
}
