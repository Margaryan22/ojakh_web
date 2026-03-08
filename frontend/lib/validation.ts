// Shared validation utilities for forms across the application

// ─── Regexes ──────────────────────────────────────────────────────────────────

/** Email must start with a letter, followed by valid chars, valid domain + TLD */
export const EMAIL_REGEX =
  /^[a-zA-Z][a-zA-Z0-9._%+\-]*@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

/** Name: Cyrillic + Latin letters, spaces, apostrophes, hyphens only */
export const NAME_REGEX = /^[А-Яа-яёЁA-Za-z\s'\-]+$/;

export const NAME_MAX_LENGTH = 30;

/** Number of user-entered digits in a Russian phone (without country code) */
export const PHONE_DIGITS_COUNT = 10;

// ─── Phone formatting ─────────────────────────────────────────────────────────

/**
 * Formats up to 10 user digits into a "+7 (XXX) (XXX) XX XX" mask.
 * Pass only the user-entered digits (no +7 prefix).
 */
export function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, PHONE_DIGITS_COUNT);
  if (d.length === 0) return '';
  if (d.length <= 3) return `+7 (${d}`;
  if (d.length <= 6) return `+7 (${d.slice(0, 3)}) (${d.slice(3)}`;
  if (d.length <= 8) return `+7 (${d.slice(0, 3)}) (${d.slice(3, 6)}) ${d.slice(6)}`;
  return `+7 (${d.slice(0, 3)}) (${d.slice(3, 6)}) ${d.slice(6, 8)} ${d.slice(8)}`;
}

/**
 * Extracts the 10 user-entered digits from a formatted phone string (strips +7).
 */
export function extractPhoneDigits(phone: string): string {
  const withoutPrefix = phone.startsWith('+7') ? phone.slice(2) : phone;
  return withoutPrefix.replace(/\D/g, '').slice(0, PHONE_DIGITS_COUNT);
}

// ─── Validators ───────────────────────────────────────────────────────────────

/**
 * Returns an error message or null.
 * @param value    current phone string (formatted, e.g. "+7 (999) ...")
 * @param touched  whether the field has been interacted with
 */
export function validatePhone(value: string, touched: boolean): string | null {
  if (!touched) return null;
  if (!value) return null; // phone is optional
  const digits = extractPhoneDigits(value);
  if (digits.length !== PHONE_DIGITS_COUNT) return 'Введите номер полностью';
  return null;
}

/**
 * Returns an error message or null.
 * @param value    current name string
 * @param touched  whether the field has been interacted with
 */
export function validateName(value: string, touched: boolean): string | null {
  if (!touched) return null;
  if (!value.trim()) return 'Имя обязательно';
  if (value.trim().length > NAME_MAX_LENGTH) return `Имя не должно превышать ${NAME_MAX_LENGTH} символов`;
  if (!NAME_REGEX.test(value.trim())) return 'Имя не должно содержать цифры или спецсимволы';
  return null;
}

/**
 * Returns an error message or null.
 * @param value    current email string
 * @param touched  whether the field has been interacted with
 */
export function validateEmail(value: string, touched: boolean): string | null {
  if (!touched) return null;
  if (!value) return 'Email обязателен';
  if (!EMAIL_REGEX.test(value)) return 'Введите корректный email';
  return null;
}
