import { AppError } from "./app-error";

/**
 * Thrown when the caller is known but may not do this: a non-admin using user
 * management (BR-012) or a cross-site mutating request (CSRF check).
 *
 * Lives in `shared/` because both modules and the shared HTTP helpers throw it.
 */
export class ForbiddenError extends AppError {
  constructor() {
    super("FORBIDDEN", "You do not have permission to perform this action.");
  }
}
