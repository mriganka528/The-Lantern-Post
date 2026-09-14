type NativeGoogleReason = 'busy' | 'setup' | 'services' | 'interrupted' | 'provider';
const messages: Record<NativeGoogleReason, string> = {
  busy: 'Another Google connection is still finishing. Please try again in a moment.',
  setup: 'Google account selection is not ready in this app version. Please update the app or use email sign-in.',
  services: 'Google Play services need attention on this phone before connecting an account.',
  interrupted: 'The Google connection was interrupted. Please try again.',
  provider: 'Google could not connect this account. Please try again.',
};
export class NativeGoogleError extends Error {
  constructor(readonly reason: NativeGoogleReason) { super(messages[reason]); this.name = 'NativeGoogleError'; }
}

let interaction: { signal: AbortSignal } | null = null;
export function isNativeGooglePickerOpen(signal: AbortSignal | undefined): boolean {
  return Boolean(signal && interaction?.signal === signal && !signal.aborted);
}
export function assertNativeGoogleActive(signal: AbortSignal) {
  if (signal.aborted) throw new NativeGoogleError('interrupted');
}
export async function withNativeGooglePicker<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T> {
  assertNativeGoogleActive(signal);
  if (interaction) throw new NativeGoogleError('busy');
  const lease = { signal }; interaction = lease;
  try { const result = await work(); assertNativeGoogleActive(signal); return result; }
  finally { if (interaction === lease) interaction = null; }
}

export function waitForNativeGoogleForeground(
  current: () => string,
  subscribe: (listener: (state: string) => void) => () => void,
  signal: AbortSignal,
  timeoutMs = 3000,
): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  if (current() === 'active') return Promise.resolve(true);
  return new Promise(resolve => {
    let settled = false; let unsubscribe: (() => void) | undefined;
    const finish = (foreground: boolean) => {
      if (settled) return; settled = true; clearTimeout(timer);
      signal.removeEventListener('abort', abort); unsubscribe?.(); resolve(foreground && !signal.aborted);
    };
    const abort = () => finish(false);
    const timer = setTimeout(abort, timeoutMs);
    signal.addEventListener('abort', abort, { once: true });
    unsubscribe = subscribe(state => { if (state === 'active') finish(true); });
    if (settled) unsubscribe();
    else if (signal.aborted) finish(false);
    else if (current() === 'active') finish(true);
  });
}
