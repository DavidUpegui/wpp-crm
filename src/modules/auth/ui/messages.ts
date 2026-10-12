import { GENERIC_ERROR_MESSAGE, USER_ERROR_MESSAGES } from "@/modules/users/ui/messages";

// Re-exported so the auth screens keep one import for their messages.
export { GENERIC_ERROR_MESSAGE };

/**
 * Spanish text shown to the user for each error `code` of the auth screens
 * (login, change password, "Mi cuenta").
 *
 * Why: domain errors carry a stable English `code`; the UI maps that code to
 * the exact text the spec defines (plan §7 "Spanish messages"). Adding a
 * message means adding one row here; no other code changes.
 *
 * Errors with a `reason` (e.g. `PASSWORD_POLICY`) use the key `CODE.reason`.
 * The UI-only codes (`*_REQUIRED`, `PASSWORD_CONFIRMATION_MISMATCH`) are form
 * validations that never reach the server use cases.
 *
 * The texts of users-domain errors (password policy, same password, empty
 * name) are owned by the users messages and reused here.
 */
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  // Login (AC-1.2, AC-1.3, AC-1.5)
  INVALID_CREDENTIALS: "Correo o contraseña incorrectos",
  ACCOUNT_DISABLED: "Tu cuenta está desactivada. Contacta a un administrador.",
  TOO_MANY_LOGIN_ATTEMPTS: "Demasiados intentos. Inténtalo de nuevo en unos minutos.",
  // Password changes (AC-4.3, AC-5.3, BR-002)
  WRONG_CURRENT_PASSWORD: "La contraseña actual no es correcta",
  "PASSWORD_POLICY.too_short": USER_ERROR_MESSAGES["PASSWORD_POLICY.too_short"],
  "PASSWORD_POLICY.too_long": USER_ERROR_MESSAGES["PASSWORD_POLICY.too_long"],
  NEW_PASSWORD_SAME_AS_CURRENT: USER_ERROR_MESSAGES.NEW_PASSWORD_SAME_AS_CURRENT,
  PASSWORD_CONFIRMATION_MISMATCH: "Las contraseñas no coinciden",
  // Own name (AC-5.1)
  NAME_REQUIRED: USER_ERROR_MESSAGES.NAME_REQUIRED,
  // Form fields left empty
  EMAIL_REQUIRED: "Ingresa tu correo electrónico",
  PASSWORD_REQUIRED: "Ingresa tu contraseña",
};

/**
 * Returns the Spanish message for an error `code` (and optional `reason`),
 * or the generic message when there is no specific one.
 */
export function getAuthErrorMessage(code: string, reason?: string): string {
  if (reason) {
    const reasonMessage = AUTH_ERROR_MESSAGES[`${code}.${reason}`];
    if (reasonMessage) {
      return reasonMessage;
    }
  }
  return AUTH_ERROR_MESSAGES[code] ?? GENERIC_ERROR_MESSAGE;
}
