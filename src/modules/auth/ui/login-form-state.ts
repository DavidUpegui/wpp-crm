/**
 * What the login Server Action returns to the login form (US-1).
 *
 * It lives in the UI module, not next to the action in `src/app/`, so the form
 * never imports from the delivery layer: the page passes the action to the form
 * as a prop instead (AGENTS.md §5.1 — dependencies point inward).
 */
export type LoginFormState = {
  status: "idle" | "error";
  /** Error for the whole form (wrong credentials, disabled account, …). */
  message?: string;
  /** Per-field errors when a field was left empty. */
  fieldErrors?: { email?: string; password?: string };
  /** The email typed, so the field is not emptied after an error. */
  email?: string;
};

/** The Server Action the login form submits to (provided by the page). */
export type LoginFormAction = (
  previousState: LoginFormState,
  formData: FormData,
) => Promise<LoginFormState>;
