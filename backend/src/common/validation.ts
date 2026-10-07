/** Indian mobile: optional +91 / 91 / 0 prefix, then 10 digits starting with 6-9. */
export const INDIAN_MOBILE_REGEX = /^(?:\+91[\s-]?|91[\s-]?|0)?[6-9]\d{9}$/;

/** Normalises any accepted Indian mobile format to the bare 10 digits. */
export function normalizeMobile(value: string): string {
  return value.replace(/\D/g, '').slice(-10);
}

/** At least 8 characters with at least one letter and one number. */
export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
export const PASSWORD_MESSAGE =
  'Password must be 8-72 characters and contain at least one letter and one number';

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
