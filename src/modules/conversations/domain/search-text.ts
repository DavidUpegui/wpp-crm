// Search rules for the conversation list (FR-012): names match regardless of
// case and accents, and phone numbers match on their digits only.

// Unicode combining marks (accents) left over after NFD decomposition.
const COMBINING_DIACRITICS_PATTERN = /[̀-ͯ]/g;
const NON_DIGIT_PATTERN = /\D/g;

/**
 * Turns text into its searchable form: trimmed, lower case and without accents,
 * so "  José " and "jose" compare equal. Used for both stored names and queries.
 */
export function normalizeSearchText(text: string): string {
  return text.trim().toLowerCase().normalize("NFD").replace(COMBINING_DIACRITICS_PATTERN, "");
}

/**
 * Keeps only the digits of a text, so "+57 300-123" can be matched against a
 * stored `wa_id` ("57300123…").
 */
export function extractDigits(text: string): string {
  return text.replace(NON_DIGIT_PATTERN, "");
}
