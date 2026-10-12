/**
 * What the "Mi cuenta" Server Actions return to their forms (US-5).
 *
 * It lives in the UI module, not next to the actions in `src/app/`, so the
 * forms never import from the delivery layer: the page passes each action to
 * its form as a prop instead (AGENTS.md §5.1 — dependencies point inward).
 */
export type AccountNameFormState = {
  status: "idle" | "success" | "error";
  /** Success text, or an error for the whole form (unexpected error…). */
  message?: string;
  /** Per-field error (empty name). */
  fieldErrors?: { name?: string };
};

/** The Server Action the "Mi cuenta" name form submits to (provided by the page). */
export type AccountNameFormAction = (
  previousState: AccountNameFormState,
  formData: FormData,
) => Promise<AccountNameFormState>;

export type AccountPasswordFormState = {
  status: "idle" | "success" | "error";
  /** Success text, or an error for the whole form (wrong current password, policy…). */
  message?: string;
  /** Per-field errors (empty fields, confirmation does not match). */
  fieldErrors?: { currentPassword?: string; newPassword?: string; passwordConfirmation?: string };
};

/** The Server Action the "Mi cuenta" password form submits to (provided by the page). */
export type AccountPasswordFormAction = (
  previousState: AccountPasswordFormState,
  formData: FormData,
) => Promise<AccountPasswordFormState>;
