export function sessionEnded(error) {
  return error.status === 401 || (error.status === 403 && ['ROLE_DENIED', 'PORTAL_ROLE_DENIED'].includes(error.code));
}

export function logoutFailure(error) {
  return `Sign-out could not be confirmed. ${error.message || 'Reconnect and try again.'}`;
}
