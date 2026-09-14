export const recoveryOnline = () => typeof navigator === 'undefined' || navigator.onLine;
export function watchRecoveryNetwork(listener: () => void) { window.addEventListener('online', listener); return () => window.removeEventListener('online', listener); }
