import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/modules/users/domain/password-policy";
import type { User, UserListStatusFilter } from "@/modules/users/domain/user";

/** Shown for any error without its own row, e.g. an unexpected server error (spec §10, §12). */
export const GENERIC_ERROR_MESSAGE = "Algo salió mal, inténtalo de nuevo";

/** Shown in the "Último acceso" column when the user never logged in (AC-6.1). */
export const NEVER_LOGGED_IN_LABEL = "Nunca";

/** Empty state of the users table (AC-6.4, spec §10). */
export const NO_USERS_FOUND_MESSAGE = "No se encontraron usuarios";

/** Link of the empty state that removes search and filters (AC-6.4). */
export const CLEAR_FILTERS_LABEL = "Limpiar filtros";

/** Shown when the list cannot be loaded (spec §10, "Usuarios (admin)" error column). */
export const USERS_LOAD_ERROR_MESSAGE = "No se pudieron cargar los usuarios";

/** Link next to the load error that loads the same list again. */
export const RETRY_LABEL = "Reintentar";

/**
 * Spanish label of each status the admin sees (AC-6.1). Keyed by the same
 * values the status filter uses, so the table and the filter never disagree.
 */
export const USER_STATUS_LABELS: Record<UserListStatusFilter, string> = {
  active: "Activo",
  inactive: "Inactivo",
  must_change_password: "Debe cambiar contraseña",
};

/**
 * Spanish text for each error `code` of user management (create, edit,
 * deactivate/reactivate, reset password).
 *
 * Errors with a `reason` (e.g. `PASSWORD_POLICY`) use the key `CODE.reason`.
 * The password-policy, name and "same password" texts are also shown by the
 * auth screens: the auth messages import them from here (auth may depend on
 * users, never the other way around), so each text is written once.
 */
export const USER_ERROR_MESSAGES: Record<string, string> = {
  // AC-7.2, BR-001
  EMAIL_ALREADY_IN_USE: "Ya existe un usuario con este correo",
  // AC-8.4, AC-9.4, BR-008
  LAST_ACTIVE_ADMIN: "Debe existir al menos un administrador activo",
  // AC-8.3, AC-9.3, AC-10.2, BR-009
  CANNOT_MODIFY_OWN_ACCOUNT: "No puedes realizar esta acción sobre tu propia cuenta",
  USER_NOT_FOUND: "El usuario no existe",
  // BR-012
  FORBIDDEN: "No tienes permiso para realizar esta acción",
  // AC-4.3, AC-7.3, BR-002
  "PASSWORD_POLICY.too_short": `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
  "PASSWORD_POLICY.too_long": `La contraseña no puede tener más de ${MAX_PASSWORD_LENGTH} caracteres`,
  NEW_PASSWORD_SAME_AS_CURRENT: "La nueva contraseña debe ser distinta de la actual",
  // AC-5.1, AC-7.3
  NAME_REQUIRED: "El nombre no puede estar vacío",
};

/**
 * Which status label a user gets in the table.
 *
 * Precedence: "Inactivo" wins over "Debe cambiar contraseña", because a
 * deactivated user cannot log in at all — the pending password change only
 * matters once the account is active again.
 */
export function getUserDisplayStatus(user: Pick<User, "status" | "mustChangePassword">): UserListStatusFilter {
  if (user.status === "inactive") {
    return "inactive";
  }
  if (user.mustChangePassword) {
    return "must_change_password";
  }
  return "active";
}

/** Spanish status label of a user, following the precedence of `getUserDisplayStatus` (AC-6.1). */
export function getUserStatusLabel(user: Pick<User, "status" | "mustChangePassword">): string {
  return USER_STATUS_LABELS[getUserDisplayStatus(user)];
}

/**
 * Returns the Spanish message for a user-management error `code` (and
 * optional `reason`, e.g. `PASSWORD_POLICY` + "too_short"), or the generic
 * message when there is no specific one.
 */
export function getUserErrorMessage(code: string, reason?: string): string {
  if (reason) {
    const reasonMessage = USER_ERROR_MESSAGES[`${code}.${reason}`];
    if (reasonMessage) {
      return reasonMessage;
    }
  }
  return USER_ERROR_MESSAGES[code] ?? GENERIC_ERROR_MESSAGE;
}
