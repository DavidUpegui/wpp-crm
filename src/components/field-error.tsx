/** Props of `FieldError`: `id` is referenced by the input's `aria-describedby`. */
type FieldErrorProps = {
  id: string;
  message?: string;
};

/**
 * Error text under one form field (e.g. "Ingresa tu contraseña"). Renders
 * nothing when there is no message, so forms can always place it.
 * Shared by every form so all field errors look the same.
 */
export function FieldError({ id, message }: FieldErrorProps): React.JSX.Element | null {
  if (!message) {
    return null;
  }
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  );
}
