/**
 * Validates email format using a simple regex pattern.
 * Allows common email formats (basic RFC 5322 compliance).
 */
export function isValidEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}
