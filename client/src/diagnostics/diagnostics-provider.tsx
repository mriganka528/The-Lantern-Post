import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import type { DiagnosticsPreferences } from '@lantern-post/shared-types';
import { apiRequest } from '../api/client';
import type { GetSessionToken } from '../api/client';
import { DiagnosticsContext } from './diagnostics-context';
import type { DiagnosticAction } from './diagnostics-context';
export function DiagnosticsProvider({ ownerId, token, children }: PropsWithChildren<{ ownerId: string; token: GetSessionToken }>) {
  const cache = useQueryClient(); const queryKey = useMemo(() => ['diagnostics', ownerId], [ownerId]);
  const prefs = useQuery({ queryKey, queryFn: ({ signal }) => apiRequest<DiagnosticsPreferences>('/diagnostics/preferences', token, { signal }), enabled: Boolean(ownerId), staleTime: 30000 });
  const [paused, setPaused] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(false); const pending = useRef(new Set<AbortController>()); const seen = useRef(new Set<string>());
  const [desired, setDesired] = useState<boolean | null>(null);
  const enabled = Boolean(ownerId && prefs.data?.enabled && !paused);
  useEffect(() => { const requests = pending.current; return () => { requests.forEach(request => request.abort()); requests.clear(); }; }, [ownerId]);
  const track = useCallback((action: DiagnosticAction, once?: string) => {
    if (!enabled || (once && seen.current.has(once))) return; if (once) seen.current.add(once);
    const abort = new AbortController(); pending.current.add(abort);
    void apiRequest('/diagnostics/events', token, { method: 'POST', signal: abort.signal, body: { eventId: randomUUID(), name: action.name, platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web', ...(action.code ? { code: action.code } : {}), ...(action.requestId ? { requestId: action.requestId } : {}) } }).catch(() => {}).finally(() => pending.current.delete(abort));
  }, [enabled, token]);
  const configure = useCallback(async (next: boolean) => {
    if (busy) return; setBusy(true); setError(false); setDesired(next); if (!next) { setPaused(true); pending.current.forEach(request => request.abort()); }
    try { const value = await apiRequest<DiagnosticsPreferences>('/diagnostics/preferences', token, { method: 'POST', body: { enabled: next } }); cache.setQueryData(queryKey, value); seen.current.clear(); setPaused(!value.enabled); setDesired(null); }
    catch { setError(true); } finally { setBusy(false); }
  }, [busy, cache, queryKey, token]);
  useEffect(() => {
    if (!enabled) return;
    const opened = () => track({ name: 'SESSION_OPEN' }, `session:${new Date().toISOString().slice(0, 10)}`);
    opened(); const subscription = AppState.addEventListener('change', state => { if (state === 'active') opened(); });
    if (Platform.OS === 'web') window.addEventListener('focus', opened);
    return () => { subscription.remove(); if (Platform.OS === 'web') window.removeEventListener('focus', opened); };
  }, [enabled, track]);
  useEffect(() => { if (!enabled || Platform.OS !== 'web') return; const record = () => track({ name: 'CLIENT_ERROR', code: 'UNHANDLED_ERROR' }); window.addEventListener('error', record); window.addEventListener('unhandledrejection', record); return () => { window.removeEventListener('error', record); window.removeEventListener('unhandledrejection', record); }; }, [enabled, track]);
  return <DiagnosticsContext.Provider value={{ enabled, ready: Boolean(ownerId && prefs.isSuccess), busy, error: error || prefs.isError, configure, retry: async () => { if (desired !== null) await configure(desired); else await prefs.refetch(); }, track }}>{children}</DiagnosticsContext.Provider>;
}
