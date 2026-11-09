/** Parse FastAPI errors into operator-safe messages (no stack traces). */

const FRIENDLY = {
  401: 'Your session ended. Sign in again.',
  403: 'You do not have permission for this action.',
  404: 'The requested record was not found.',
  409: 'Another change conflicted with this update. Refresh and try again.',
  422: 'Some fields are invalid. Check the form and try again.',
  429: 'Too many requests. Wait a moment and try again.',
  502: 'An upstream provider did not respond.',
  503: 'The service is temporarily unavailable.',
};

export function parseApiFailure(status, body, requestId) {
  let message = FRIENDLY[status] || `Request failed (${status}).`;
  let code = `HTTP_${status}`;
  let id = requestId || body?.error?.request_id || '';

  if (body?.error?.message) {
    message = body.error.message;
    code = body.error.code || code;
    id = body.error.request_id || id;
  } else if (typeof body?.detail === 'string') {
    message = body.detail;
  } else if (body?.detail) {
    message = 'Validation failed. Check your input.';
  }

  if (/authentication required/i.test(message)) {
    message = FRIENDLY[401];
  }

  return { message, code, requestId: id };
}

export function attachApiError(err, meta) {
  err.apiStatus = meta?.status;
  err.requestId = meta?.requestId;
  err.errorCode = meta?.code;
  return err;
}
