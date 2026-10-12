/**
 * Returns the canonical form of an email address: no surrounding spaces and
 * all lower case.
 *
 * Why: emails are unique case-insensitively (BR-001), so "  Ana@Example.com "
 * and "ana@example.com" must be the same user (AC-1.6). Normalizing with this
 * one function everywhere — before saving, looking up or comparing — keeps a
 * single canonical form in the database and in the code.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
