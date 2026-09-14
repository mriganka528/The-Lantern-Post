export interface SentrySettings { endpoint: string; publicKey: string; }
export function sentrySettings(value: string): SentrySettings {
  try { const url = new URL(value); const segments = url.pathname.split('/').filter(Boolean); const project = segments.pop();
    if (url.protocol !== 'https:' || !/^[a-zA-Z0-9]+$/.test(url.username) || url.password || url.search || url.hash || !project || !/^\d+$/.test(project)) throw new Error();
    return { endpoint: `${url.origin}/${[...segments, 'api', project, 'envelope', ''].join('/')}`, publicKey: url.username };
  } catch { throw new Error('DIAGNOSTICS_SENTRY_DSN must be a valid HTTPS Sentry DSN.'); }
}
export function sentryEnvelope(event: { id: string; platform: string; code: string | null; occurredAt: Date }) {
  const eventId = event.id.replace(/^diag_/, '').slice(0, 32);
  // Deliberately exclude arbitrary messages, stacks, URLs, users and breadcrumbs.
  return `${JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() })}\n${JSON.stringify({ type: 'event' })}\n${JSON.stringify({ event_id: eventId, timestamp: event.occurredAt.getTime() / 1000, platform: 'javascript', level: 'error', release: 'lantern-post@0.1.0', message: event.code === 'RENDER_ERROR' ? 'Lantern Post screen could not render' : 'Lantern Post unhandled application error', tags: { platform: event.platform, code: event.code } })}\n`;
}
export function summarizeDiagnostics(events: { actorKey: string; name: string; occurredAt: Date }[], now = new Date()) {
  const actors = new Map<string, { first: number; sessions: number[]; sends: number[] }>();
  for (const event of events) { let actor = actors.get(event.actorKey); if (!actor) { actor = { first: Infinity, sessions: [], sends: [] }; actors.set(event.actorKey, actor); } const at = event.occurredAt.getTime();
    if (event.name === 'SESSION_OPEN') { actor.first = Math.min(actor.first, at); actor.sessions.push(at); }
    if (['BURN_COMPLETED','FRIEND_DELIVERED','WORLD_SHARED'].includes(event.name)) actor.sends.push(at);
  }
  const day = 86400000; const cohort = [...actors.values()].filter(a => Number.isFinite(a.first));
  const retention = (days: number) => { const eligible = cohort.filter(a => now.getTime() >= a.first + (days + 1) * day); return { eligible: eligible.length, returned: eligible.filter(a => a.sessions.some(at => at >= a.first + days * day && at < a.first + (days + 1) * day)).length }; };
  const seconds = cohort.flatMap(a => { const first = Math.min(...a.sends.filter(at => at >= a.first)); return Number.isFinite(first) ? [(first - a.first) / 1000] : []; }).sort((a,b) => a-b);
  return { measuredPeople: cohort.length, events: events.length, d1: retention(1), d7: retention(7), firstConfirmedSendSamples: seconds.length, medianSecondsToFirstConfirmedSend: seconds.length ? seconds[Math.floor(seconds.length / 2)] : null };
}
