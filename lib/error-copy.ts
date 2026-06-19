import type { ErrorCopy, ErrorDisposition, ErrorDomain } from './error-message';

/**
 * Canonical (domain × disposition) → { title, body } table. The single
 * source of truth for every user-facing error string in the app.
 *
 * Brand voice: Steady Companion — calm, grounded, no exclamation
 * points, no "Oops!" or "Whoops!", no performative apologies. Make a
 * statement of fact and offer a next step.
 *
 * `null` slots are silent dispositions (cancelled across all domains;
 * a few domain × disposition pairs that don't exist semantically).
 * getErrorMessage degrades gracefully to empty strings for those.
 *
 * To adjust copy: edit this file. All ~24 caller sites pick up the
 * change next render.
 */
export const ERROR_COPY: Record<
  ErrorDomain,
  Record<ErrorDisposition, ErrorCopy | null>
> = {
  recordings: {
    transient:     { title: "Couldn't save your recording",  body: 'Try again in a moment.' },
    permanent:     { title: "Couldn't start recording",       body: 'Try a different microphone or restart the app.' },
    'needs-setup': null,
    cancelled:     null,
  },
  sharing: {
    transient:     { title: "Couldn't start sharing",         body: 'Try again in a moment.' },
    permanent:     { title: 'Sharing unavailable',            body: "We can't reach your trusted contact right now." },
    'needs-setup': { title: 'No trusted contact yet',         body: 'Set one up to share your location.' },
    cancelled:     null,
  },
  contact: {
    transient:     { title: "Couldn't pick a contact",        body: 'Try again.' },
    permanent:     { title: "That contact won't work",        body: 'They need a phone number we can text and call.' },
    'needs-setup': { title: 'No trusted contact yet',         body: 'Set one up first to call or text from here.' },
    cancelled:     null,
  },
  report: {
    transient:     { title: "Couldn't send your report",      body: 'Try again.' },
    permanent:     { title: 'Report unavailable',             body: "We can't send this one." },
    'needs-setup': null,
    cancelled:     null,
  },
  save: {
    transient:     { title: "Couldn't save",                  body: 'Try again in a moment.' },
    permanent:     { title: "Couldn't save",                  body: "Your changes weren't saved." },
    'needs-setup': null,
    cancelled:     null,
  },
  load: {
    transient:     { title: "Couldn't load",                  body: 'Reopen this screen to try again.' },
    permanent:     { title: "Couldn't load this",             body: 'Something went wrong on our side.' },
    'needs-setup': null,
    cancelled:     null,
  },
  auth: {
    transient:     { title: 'Sign-in failed',                 body: 'Try again.' },
    permanent:     { title: "Can't sign in",                  body: 'Check your Apple ID and try again.' },
    'needs-setup': null,
    cancelled:     null,
  },
};
