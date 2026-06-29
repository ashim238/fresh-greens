import type { ReportSubmitError } from './api/sources/community-cloud';
import type { ErrorCopy } from './error-message';

const REPORT_SUBMIT_COPY: Record<ReportSubmitError, ErrorCopy> = {
  'device-banned': {
    title: 'Submissions paused for this device',
    body: 'A moderator restricted reporting from this device. This is usually temporary.',
  },
  'otp-required': {
    title: 'Phone verification needed',
    body: 'Verify your phone number to continue submitting safety reports.',
  },
  'rate-limited': {
    title: 'Too many reports today',
    body: "You've reached the daily limit. Try again tomorrow.",
  },
  'cluster-limited': {
    title: 'Already reported nearby',
    body: "There's a recent report from you within 50 meters of this spot.",
  },
  unknown: {
    title: "Couldn't send your report",
    body: 'Try again in a moment.',
  },
};

export function getReportSubmitErrorCopy(error: ReportSubmitError): ErrorCopy {
  return REPORT_SUBMIT_COPY[error];
}
