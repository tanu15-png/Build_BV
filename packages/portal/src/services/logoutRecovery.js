// Keep the sign-out intent until the server confirms it, including after a
// timeout where the request may already have revoked the session.
export function createLogoutRecovery({ revoke, onSuccess, onError }) {
  let pending = false;
  let inFlight;
  return {
    pending: () => pending,
    logout() {
      if (inFlight) return inFlight;
      pending = true;
      inFlight = Promise.resolve().then(revoke).then(async () => {
        await onSuccess();
        pending = false;
      }).catch(error => {
        onError(error);
        throw error;
      }).finally(() => {
        inFlight = undefined;
      });
      return inFlight;
    },
  };
}
