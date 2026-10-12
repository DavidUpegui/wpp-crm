/**
 * Base class for every error this application throws on purpose.
 *
 * Why: route handlers and server actions can check `error instanceof AppError`
 * to show a safe, user-facing message, while unexpected errors (bugs) are
 * logged and answered with a generic 500.
 *
 * How to use: create one subclass per business problem, e.g.
 *
 *   export class OutsideCustomerServiceWindowError extends AppError {
 *     constructor() {
 *       super("OUTSIDE_CUSTOMER_SERVICE_WINDOW", "Only templates can be sent after 24h without a customer reply.");
 *     }
 *   }
 */
export abstract class AppError extends Error {
  /** Stable, machine-readable identifier (useful for the UI and for tests). */
  public readonly code: string;

  /**
   * Optional extra fields that are safe to send to the client, so the UI can
   * show a precise message (e.g. `{ reason: "too_short" }` for the password
   * policy). Never put personal data or secrets here.
   */
  public readonly details?: Record<string, string>;

  protected constructor(code: string, message: string, details?: Record<string, string>) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}
