/**
 * What the user-management Server Actions (create, edit, deactivate,
 * reactivate, reset password) return to their dialogs (US-7–US-10).
 *
 * It lives in the UI module, not next to the actions in `src/app/`, so the
 * dialogs never import from the delivery layer: the page passes each action
 * down as a prop instead (AGENTS.md §5.1 — dependencies point inward).
 */
export type UserDialogState = {
  status: "idle" | "success" | "error";
  /** Success text (shown as a toast), or an error for the whole dialog (last admin, no permission…). */
  message?: string;
  /** Per-field errors (empty name, invalid email, duplicate email, missing role, password policy). */
  fieldErrors?: UserDialogFieldErrors;
};

/** One optional error per form field; each dialog only shows the fields it has. */
export type UserDialogFieldErrors = {
  name?: string;
  email?: string;
  role?: string;
  temporaryPassword?: string;
};

/** The Server Action a user-management dialog submits to (provided by the page). */
export type UserDialogAction = (previousState: UserDialogState, formData: FormData) => Promise<UserDialogState>;

/** The five user-management actions the "Usuarios" page passes down to its table and header. */
export type UserManagementActions = {
  createUser: UserDialogAction;
  updateUser: UserDialogAction;
  deactivateUser: UserDialogAction;
  reactivateUser: UserDialogAction;
  resetUserPassword: UserDialogAction;
};

/** The starting state of every user-management dialog. */
export const INITIAL_USER_DIALOG_STATE: UserDialogState = { status: "idle" };
