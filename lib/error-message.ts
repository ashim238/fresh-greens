import { ERROR_COPY } from './error-copy';

/**
 * The taxonomy. Two narrow axes — every error site picks one from each.
 *
 * Domain: WHAT failed (the subject of the error).
 * Disposition: HOW it failed (the retry posture).
 *
 * Adding a domain or disposition: edit both this union AND the table
 * in lib/error-copy.ts. TypeScript enforces every combination exists
 * (the table is keyed on the unions); the `null` sentinel handles
 * silent slots (cancelled, plus a few combinations that don't exist
 * semantically — e.g. report + needs-setup).
 */
export type ErrorDomain =
  | 'recordings'
  | 'sharing'
  | 'contact'
  | 'report'
  | 'save'
  | 'load'
  | 'auth';

export type ErrorDisposition =
  | 'transient'
  | 'permanent'
  | 'needs-setup'
  | 'cancelled';

export type ErrorCopy = { title: string; body: string };

/**
 * Side-effect: when `error` is supplied (any value including null),
 * emits one canonical [domain:disposition] console.warn replacing the
 * ~20 ad-hoc patterns across the codebase. Handler-mode callers (catch
 * blocks, result.ok narrows) should always pass `error` — the call
 * itself is the failure event; pass null explicitly if no payload is
 * available. Render-mode callers (component-internal copy lookup in
 * JSX) pass no error → no log fires, so re-renders don't spam.
 *
 * Otherwise referentially transparent — no JSX, no React, callable
 * from any handler.
 *
 * Silent dispositions (cancelled, and the few null slots in the table)
 * return empty strings — this is LOAD-BEARING, not just defensive:
 * <SafetyErrorMessage> renders nothing when body is empty, which is
 * how the cancelled disposition stays silent. Empty-string-on-typo is
 * the cost we accept for that pattern; TypeScript catches the typos at
 * compile time so the empty branch is only ever hit via the deliberate
 * null slots.
 */
export function getErrorMessage(
  domain: ErrorDomain,
  disposition: ErrorDisposition,
  error?: unknown,
): ErrorCopy {
  if (error !== undefined) {
    console.warn(`[${domain}:${disposition}]`, error);
  }
  const copy = ERROR_COPY[domain][disposition];
  return copy ?? { title: '', body: '' };
}
