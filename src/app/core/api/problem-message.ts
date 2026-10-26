import { HttpErrorResponse } from '@angular/common/http';
import { ProblemDetails } from '../models/problem-details.model';

const CANNOT_REACH_SERVER = "Can't reach the server. Check your connection and try again.";
const GENERIC_ERROR = 'Something went wrong. Try again.';

/**
 * A user-facing message from an HTTP error: the field messages of a validation error, else ProblemDetails `detail`,
 * else `title`.
 */
export function problemMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return GENERIC_ERROR;
  }
  if (error.status === 0) {
    return CANNOT_REACH_SERVER;
  }
  // The body may be text or HTML (e.g. from a proxy); the optional chaining then falls through to the generic message.
  const problem = error.error as ProblemDetails | null;
  const fieldMessages = Object.values(problem?.errors ?? {}).flat();
  if (fieldMessages.length > 0) {
    return fieldMessages.join(' ');
  }
  return problem?.detail || problem?.title || GENERIC_ERROR;
}
