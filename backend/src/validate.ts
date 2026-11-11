import type { TransactionInput, TransactionType } from './types';

// A "discriminated union": check `result.ok` and TypeScript knows which
// of the two shapes you have (the valid value, or the list of errors).
export type ValidationResult =
  | { ok: true; value: TransactionInput }
  | { ok: false; errors: string[] };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/; // e.g. 2026-11-09

// Today's date in YYYY-MM-DD, using your computer's local time zone.
export function today(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // getMonth() is 0-based
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidDate(value: string): boolean {
  // The pattern checks the shape, Date.parse rejects things like 2026-13-45.
  return DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

// Anything can arrive in a request body, so we start from `unknown`
// and check every field before trusting it.
export function validateTransactionInput(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, errors: ['Request body must be a JSON object'] };
  }

  const { type, amountCents, category, description, date } = body as Record<string, unknown>;
  const errors: string[] = [];

  if (type !== 'income' && type !== 'expense') {
    errors.push('type must be "income" or "expense"');
  }
  if (typeof amountCents !== 'number' || !Number.isSafeInteger(amountCents) || amountCents <= 0) {
    errors.push('amountCents must be a positive whole number (e.g. 1250 for $12.50)');
  }
  if (typeof category !== 'string' || category.trim() === '') {
    errors.push('category is required');
  }
  if (description !== undefined && typeof description !== 'string') {
    errors.push('description must be a string');
  }
  if (date !== undefined && (typeof date !== 'string' || !isValidDate(date))) {
    errors.push('date must be a real date in the format YYYY-MM-DD');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Every field was checked above, so it's safe to tell TypeScript their types.
  return {
    ok: true,
    value: {
      type: type as TransactionType,
      amountCents: amountCents as number,
      category: (category as string).trim(),
      description: (description as string | undefined) ?? '',
      date: (date as string | undefined) ?? today(),
    },
  };
}
