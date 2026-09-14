// Native retries learn connectivity through the authenticated receipt request;
// no extra native network package or background permission is required.
export const recoveryOnline = () => true;
export const watchRecoveryNetwork = (_listener: () => void) => () => {};
