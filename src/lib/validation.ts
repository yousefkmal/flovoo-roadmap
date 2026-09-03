/**
 * Form validation shared by the client and the server.
 *
 * Rules return an error *code*, not a message: the server does not know the
 * visitor's language, and the same rule has to render in Arabic and English.
 * The client maps codes to dictionary strings.
 *
 * The client runs these for instant feedback; the server runs them again
 * because the client's copy can be bypassed.
 */

export type FieldError =
  | "required"
  | "tooShort"
  | "tooLong"
  | "invalidEmail"
  | "unknownCategory";

export const LIMITS = {
  title: { min: 4, max: 120 },
  description: { max: 1000 },
  name: { min: 2, max: 80 },
  email: { max: 254 },
} as const;

// Deliberately permissive: the goal is to catch typos, not to adjudicate the
// RFC. Anything stricter rejects real addresses.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateTitle(value: string): FieldError | null {
  const trimmed = value.trim();
  if (!trimmed) return "required";
  if (trimmed.length < LIMITS.title.min) return "tooShort";
  if (trimmed.length > LIMITS.title.max) return "tooLong";
  return null;
}

export function validateDescription(value: string): FieldError | null {
  if (value.trim().length > LIMITS.description.max) return "tooLong";
  return null;
}

export function validateName(value: string): FieldError | null {
  const trimmed = value.trim();
  if (!trimmed) return "required";
  if (trimmed.length < LIMITS.name.min) return "tooShort";
  if (trimmed.length > LIMITS.name.max) return "tooLong";
  return null;
}

export function validateEmail(value: string): FieldError | null {
  const trimmed = value.trim();
  if (!trimmed) return "required";
  if (trimmed.length > LIMITS.email.max) return "tooLong";
  if (!EMAIL.test(trimmed)) return "invalidEmail";
  return null;
}

export function validateCategory(
  value: string,
  known: readonly string[],
): FieldError | null {
  if (!value) return null; // optional
  return known.includes(value) ? null : "unknownCategory";
}

/**
 * Whether a stored URL is safe to render as an `href`.
 *
 * The database constrains this too, but a row can predate a constraint or
 * arrive from a migration, and `javascript:` in an href is a script execution.
 * Anything that is not plainly http(s) is dropped rather than rendered.
 */
export function isSafeHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
