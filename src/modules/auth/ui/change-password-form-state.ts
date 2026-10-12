/**
 * What the forced change-password Server Action returns to its form (US-4).
 *
 * It lives in the UI module, not next to the action in `src/app/`, so the form
 * never imports from the delivery layer: the page passes the action to the form
 * as a prop instead (AGENTS.md §5.1 — dependencies point inward).
 */
export type ChangePasswordFormState = {
  status: "idle" | "error";
  /** Error for the whole form (policy, same as temporary, unexpected error…). */
  message?: string;
  /** Per-field errors (empty new password, confirmation does not match). */
  fieldErrors?: { newPassword?: string; passwordConfirmation?: string };
};

/** The Server Action the change-password form submits to (provided by the page). */
export type ChangePasswordFormAction = (
  previousState: ChangePasswordFormState,
  formData: FormData,
) => Promise<ChangePasswordFormState>;
