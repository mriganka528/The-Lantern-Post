import type { BurnLetterRequest, BurnReceipt, DeliveryReceipt, FriendTextLetterRequest, LetterPreset, LetterRecipient, StationeryConfig, VoiceClip, WorldReceipt } from '@lantern-post/shared-types';
import { readBurnReceipt, requestIdPattern } from './burn-contract';
import { cleanRecipient, deliveryRejectionMessage, readDeliveryReceipt } from './delivery-contract';
import { cleanVoiceClip } from '../voice/voice-contract';
import { readRemovedLetter } from './removed-letter';
import { readWorldReceipt, worldRejectionMessage } from '../infinity/world-contract';
import type { PendingWorldLetter } from '../infinity/world-contract';
export const terminalStage = (stage: unknown) => stage === 'burned' || stage === 'delivered' || stage === 'published';
export const pendingStage = (stage: unknown) => stage === 'burn-pending' || stage === 'delivery-pending' || stage === 'world-pending';

export const LETTER_LIMIT = 2000;
export const characterCount = (text: string) => Array.from(text).length;
export function letterProblem(text: string): string | null {
  if (!text.trim()) return 'Give your letter a few words before sealing it.';
  const extra = characterCount(text) - LETTER_LIMIT;
  return extra > 0 ? `Your letter is ${extra} character${extra === 1 ? '' : 's'} over the limit.` : null;
}
export function draftProblem(draft: LetterDraft): string | null {
  if (draft.voiceDeletes.length) return 'Finish clearing the previous recording before sealing this letter.';
  return draft.kind === 'VOICE' ? draft.voice ? null : 'Record a little message before sealing it.' : letterProblem(draft.text);
}
export type PendingFriendDelivery = FriendTextLetterRequest | { requestId: string; type: 'VOICE'; destinationType: 'FRIEND'; presetId: string; recipientId: string; deliveryConfirmed: true; voice: VoiceClip; voiceCaption?: string };

export interface LetterDraft {
  version: 6;
  generationId: string;
  ownerId: string;
  text: string;
  kind: 'TEXT' | 'VOICE';
  voice: VoiceClip | null;
  voiceCaption: string;
  voiceDeletes: string[];
  preset: LetterPreset | null;
  stage: 'writing' | 'sealed' | 'burn-pending' | 'burned' | 'delivery-pending' | 'delivered' | 'world-pending' | 'published';
  updatedAt: string;
  sealedAt: string | null;
  burnRequestId: string | null;
  burnReceipt: BurnReceipt | null;
  deliveryRequestId: string | null;
  deliveryRecipient: LetterRecipient | null;
  deliveryReceipt: DeliveryReceipt | null;
  worldSigned: boolean;
  worldRequestId: string | null;
  worldReceipt: WorldReceipt | null;
}

export function cleanPreset(input: unknown): LetterPreset | null {
  if (!input || typeof input !== 'object') return null;
  const p = input as Record<string, unknown>;
  if (!['id', 'key', 'displayName', 'description'].every(key => typeof p[key] === 'string' && (p[key] as string).length <= 200)) return null;
  if (!p.config || typeof p.config !== 'object') return null;
  const c = p.config as Record<string, unknown>;
  if (!['paperColor', 'inkColor', 'sealColor', 'ribbonColor'].every(key => typeof c[key] === 'string' && /^#[\da-f]{6}$/i.test(c[key])) ||
    typeof c.texture !== 'string' || !['parchment', 'linen', 'vellum'].includes(c.texture) ||
    typeof c.motif !== 'string' || !['stars', 'floral', 'royal', 'postmark', 'lace', 'peacock', 'rose-vine', 'celestial', 'regal', 'gilded'].includes(c.motif) ||
    typeof c.font !== 'string' || !['book', 'script', 'classic'].includes(c.font)) return null;
  return {
    id: p.id as string, key: p.key as string, displayName: p.displayName as string, description: p.description as string,
    ...(p.collection === 'royal' ? { collection: 'royal' as const } : {}),
    config: {
      paperColor: c.paperColor as string, inkColor: c.inkColor as string, sealColor: c.sealColor as string, ribbonColor: c.ribbonColor as string,
      texture: c.texture as StationeryConfig['texture'], motif: c.motif as StationeryConfig['motif'], font: c.font as StationeryConfig['font'],
    },
  };
}

// Generation IDs distinguish local pages, not authenticated operations. The
// app supplies Expo Crypto's UUID factory; the fallback also supports Node tests.
function localGenerationId() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`; }

export function newDraft(ownerId: string, generationId = localGenerationId()): LetterDraft {
  return { version: 6, generationId, ownerId, text: '', kind: 'TEXT', voice: null, voiceCaption: '', voiceDeletes: [], preset: null, stage: 'writing', updatedAt: new Date().toISOString(), sealedAt: null, burnRequestId: null, burnReceipt: null, deliveryRequestId: null, deliveryRecipient: null, deliveryReceipt: null, worldSigned: false, worldRequestId: null, worldReceipt: null };
}

export function decodeDraft(raw: string | null, ownerId: string): LetterDraft {
  if (raw === null) return newDraft(ownerId);
  if (raw.length > 100_000) throw new Error('Draft could not be restored.');
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('Draft could not be restored.');
  const d = value as Record<string, unknown>;
  const preset = d.preset === null ? null : cleanPreset(d.preset);
  const requestId = typeof d.burnRequestId === 'string' ? d.burnRequestId.toLowerCase() : null;
  const receipt = requestId ? readBurnReceipt(d.burnReceipt, requestId) : null;
  const deliveryRequestId = typeof d.deliveryRequestId === 'string' ? d.deliveryRequestId.toLowerCase() : null;
  const deliveryRecipient = cleanRecipient(d.deliveryRecipient);
  const deliveryReceipt = deliveryRequestId && deliveryRecipient ? readDeliveryReceipt(d.deliveryReceipt, deliveryRequestId, deliveryRecipient.id) : null;
  const delivering = d.stage === 'delivery-pending' || d.stage === 'delivered';
  const publishing = d.stage === 'world-pending' || d.stage === 'published';
  const worldSigned = Number(d.version) >= 5 ? d.worldSigned : false;
  const voiceCaption = d.version === 6 ? d.voiceCaption : '';
  const worldRequestId = typeof d.worldRequestId === 'string' ? d.worldRequestId.toLowerCase() : null;
  const worldReceipt = worldRequestId ? readWorldReceipt(d.worldReceipt, worldRequestId, worldSigned === true) : null;
  const kind = Number(d.version) >= 4 ? d.kind : 'TEXT'; const voice = cleanVoiceClip(d.voice);
  const voiceDeletes = Number(d.version) >= 4 ? d.voiceDeletes : [];
  const contentValid = kind === 'VOICE' ? Boolean(voice) : letterProblem(typeof d.text === 'string' ? d.text : '') === null;
  if (![1, 2, 3, 4, 5, 6].includes(d.version as number) || !['TEXT', 'VOICE'].includes(String(kind)) || d.ownerId !== ownerId || typeof d.text !== 'string' || d.text.length > 20_000 || typeof worldSigned !== 'boolean' || typeof voiceCaption !== 'string' || characterCount(voiceCaption) > LETTER_LIMIT || (voiceCaption !== '' && (kind !== 'VOICE' || terminalStage(d.stage))) ||
    typeof d.stage !== 'string' || !['writing', 'sealed', 'burn-pending', 'burned', 'delivery-pending', 'delivered', 'world-pending', 'published'].includes(d.stage) || (d.preset !== null && !preset) ||
    typeof d.updatedAt !== 'string' || !Number.isFinite(Date.parse(d.updatedAt)) ||
    (d.version === 1 && d.stage !== 'writing' && d.stage !== 'sealed') ||
    (d.version !== 1 && (typeof d.generationId !== 'string' || !d.generationId || d.generationId.length > 200)) ||
    ((d.stage === 'sealed' || pendingStage(d.stage)) && (!preset || !contentValid || typeof d.sealedAt !== 'string' || !Number.isFinite(Date.parse(d.sealedAt)))) ||
    ((d.stage === 'burn-pending' || d.stage === 'burned') && (!requestId || !requestIdPattern.test(requestId))) ||
    (d.stage === 'burned' && (!receipt || receipt.outcome !== 'BURNED')) ||
    (delivering && (![3, 4, 5, 6].includes(Number(d.version)) || !deliveryRecipient || !deliveryRequestId || !requestIdPattern.test(deliveryRequestId))) ||
    (d.stage === 'delivered' && (!deliveryReceipt || deliveryReceipt.outcome !== 'DELIVERED')) ||
    (publishing && (![5, 6].includes(Number(d.version)) || !worldRequestId || !requestIdPattern.test(worldRequestId))) || (d.stage === 'published' && (!worldReceipt || worldReceipt.outcome !== 'DELIVERED')) ||
    (Number(d.version) >= 4 && ((d.voice !== null && !voice) || (kind === 'TEXT' && d.voice !== null) || (kind === 'VOICE' && d.text !== '') || (terminalStage(d.stage) && d.voice !== null))) ||
    !Array.isArray(voiceDeletes) || voiceDeletes.length > 8 || voiceDeletes.some(id => typeof id !== 'string' || !requestIdPattern.test(id)) || new Set(voiceDeletes).size !== voiceDeletes.length || (voice && voiceDeletes.includes(voice.id))) {
    throw new Error('Draft could not be restored.');
  }
  return {
    version: 6, generationId: d.version === 1 ? `legacy:${ownerId}:${d.updatedAt}` : d.generationId as string,
    ownerId, text: terminalStage(d.stage) ? '' : d.text, preset, stage: d.stage as LetterDraft['stage'], updatedAt: d.updatedAt,
    kind: kind as LetterDraft['kind'], voice: kind === 'VOICE' && !terminalStage(d.stage) ? voice : null, voiceDeletes: voiceDeletes as string[],
    voiceCaption,
    sealedAt: d.stage === 'sealed' || pendingStage(d.stage) ? d.sealedAt as string : null,
    burnRequestId: d.stage === 'burn-pending' || d.stage === 'burned' ? requestId : null,
    burnReceipt: d.stage === 'burned' ? receipt : null,
    deliveryRequestId: delivering ? deliveryRequestId : null,
    deliveryRecipient: delivering ? deliveryRecipient : null,
    deliveryReceipt: d.stage === 'delivered' ? deliveryReceipt : null,
    worldSigned, worldRequestId: publishing ? worldRequestId : null, worldReceipt: d.stage === 'published' ? worldReceipt : null,
  };
}

export interface DraftStorage {
  read(key: string): string | null;
  write(key: string, value: string): void;
  subscribe?(key: string, listener: () => void): () => void;
}
export interface DraftSnapshot {
  phase: 'loading' | 'ready' | 'load-error' | 'removed';
  draft: LetterDraft | null;
  save: 'saved' | 'error';
  notice?: string;
}

// Small synchronous local writes preserve ordering and finish before navigation.
// There are no background requests that can write another account's draft.
export class DraftController {
  private snapshot: DraftSnapshot = { phase: 'loading', draft: null, save: 'saved' };
  private listeners = new Set<() => void>();
  private lastStored: string | null = null;
  private freshAfterCleanup = false;
  readonly key: string;

  constructor(private readonly ownerId: string, private readonly storage: DraftStorage, private readonly makeId = localGenerationId, documentId?: string) {
    if (!ownerId) throw new Error('A draft owner is required.');
    this.key = draftKey(ownerId, documentId);
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(snapshot: DraftSnapshot) { this.snapshot = snapshot; this.listeners.forEach(listener => listener()); }
  load() {
    try {
      this.lastStored = this.storage.read(this.key);
      if (readRemovedLetter(this.lastStored, this.ownerId)) { this.publish({ phase: 'removed', draft: null, save: 'saved' }); return; }
      const draft = this.lastStored === null ? newDraft(this.ownerId, this.makeId()) : decodeDraft(this.lastStored, this.ownerId);
      this.publish({ phase: 'ready', draft, save: 'saved' });
    }
    catch { this.publish({ phase: 'load-error', draft: null, save: 'saved' }); }
  }
  openDesk() {
    this.load();
    const stage = this.snapshot.draft?.stage;
    // A cold visit is a request to write. A verified, locally saved terminal
    // result is finished; pending/failed cleanup must still recover its receipt.
    this.freshAfterCleanup = terminalStage(stage);
    if (this.freshAfterCleanup && this.snapshot.save === 'saved' && !this.snapshot.draft?.voiceDeletes.length) this.reset();
  }
  refresh() {
    try { if (this.storage.read(this.key) !== this.lastStored) this.load(); }
    catch { this.publish({ ...this.snapshot, save: 'error' }); }
  }
  watchStorage() { return this.storage.subscribe?.(this.key, () => this.refresh()) ?? (() => {}); }
  private commit(draft: LetterDraft, requireSaved = false): boolean {
    try {
      // An old editor/tab must not resurrect a burned or replaced page.
      const current = this.storage.read(this.key);
      if (readRemovedLetter(current, this.ownerId)) { this.load(); return false; }
      if (current !== this.lastStored) {
        this.load();
        this.publish({ ...this.snapshot, notice: 'This letter changed in another window. The saved version is shown here.' });
        return false;
      }
      const serialized = JSON.stringify(draft);
      this.storage.write(this.key, serialized);
      this.lastStored = serialized;
      this.publish({ phase: 'ready', draft, save: 'saved' });
      return true;
    } catch {
      this.publish({ ...this.snapshot, draft: requireSaved ? this.snapshot.draft : draft, save: 'error' });
      return false;
    }
  }
  edit(text: string) {
    const d = this.snapshot.draft;
    if (!d || d.stage !== 'writing' || d.kind !== 'TEXT' || text.length > 20_000) return;
    this.commit({ ...d, text, updatedAt: new Date().toISOString() });
  }
  choosePreset(preset: LetterPreset) {
    const d = this.snapshot.draft;
    const clean = cleanPreset(preset);
    if (!d || d.stage !== 'writing' || !clean) return;
    this.commit({ ...d, preset: clean, updatedAt: new Date().toISOString() });
  }
  changeKind(kind: 'TEXT' | 'VOICE'): boolean {
    const d = this.snapshot.draft; if (!d || d.stage !== 'writing' || d.voiceDeletes.length) return false;
    return this.commit({ ...d, kind, text: '', voice: null, voiceCaption: '', voiceDeletes: d.voice ? [d.voice.id] : [], updatedAt: new Date().toISOString() }, true);
  }
  attachVoice(value: VoiceClip): boolean {
    const d = this.snapshot.draft; const voice = cleanVoiceClip(value);
    if (!d || d.kind !== 'VOICE' || d.stage !== 'writing' || d.voice || d.voiceDeletes.length || !voice) return false;
    return this.commit({ ...d, voice, updatedAt: new Date().toISOString() }, true);
  }
  discardVoice(): boolean {
    const d = this.snapshot.draft; if (!d || d.stage !== 'writing' || !d.voice || d.voiceDeletes.length) return false;
    return this.commit({ ...d, voice: null, voiceCaption: '', voiceDeletes: [d.voice.id], updatedAt: new Date().toISOString() }, true);
  }
  editVoiceCaption(text: string) { const d = this.snapshot.draft; if (d?.kind === 'VOICE' && d.stage === 'writing' && characterCount(text) <= LETTER_LIMIT) this.commit({ ...d, voiceCaption: text, updatedAt: new Date().toISOString() }); }
  finishVoiceDelete(id: string): boolean {
    const d = this.snapshot.draft; if (!d?.voiceDeletes.includes(id)) return true;
    const saved = this.commit({ ...d, voiceDeletes: d.voiceDeletes.filter(value => value !== id) }, true);
    if (saved && this.freshAfterCleanup && !this.snapshot.draft?.voiceDeletes.length) return this.reset();
    return saved;
  }
  seal(): boolean {
    const d = this.snapshot.draft;
    if (!d || d.stage !== 'writing' || !d.preset || draftProblem(d)) return false;
    const timestamp = new Date().toISOString();
    return this.commit({ ...d, stage: 'sealed', sealedAt: timestamp, updatedAt: timestamp }, true);
  }
  unseal() {
    const d = this.snapshot.draft;
    if (d?.stage === 'sealed') this.commit({ ...d, stage: 'writing', sealedAt: null, updatedAt: new Date().toISOString() });
  }
  retrySave(): boolean { return this.snapshot.draft ? this.commit(this.snapshot.draft) : false; }
  reset(): boolean {
    const stage = this.snapshot.draft?.stage;
    const before = this.snapshot.draft;
    if (pendingStage(stage) || (terminalStage(stage) && (this.snapshot.save === 'error' || before?.voiceDeletes.length))) return false;
    const voiceDeletes = [...new Set([...(before?.voiceDeletes ?? []), ...(before?.voice ? [before.voice.id] : [])])];
    const saved = this.commit({ ...newDraft(this.ownerId, this.makeId()), voiceDeletes }, true); if (saved) this.freshAfterCleanup = false; return saved;
  }
  beginBurn(requestId: string): boolean {
    const d = this.snapshot.draft;
    if (!d || d.stage !== 'sealed' || !d.preset || this.snapshot.save !== 'saved' || draftProblem(d) || !requestIdPattern.test(requestId)) return false;
    return this.commit({ ...d, stage: 'burn-pending', burnRequestId: requestId.toLowerCase(), burnReceipt: null, updatedAt: new Date().toISOString() }, true);
  }
  pendingBurn(): BurnLetterRequest | null {
    const d = this.snapshot.draft;
    if (!d || d.stage !== 'burn-pending' || !d.preset || !d.burnRequestId) return null;
    if (d.kind === 'VOICE') return d.voice ? { requestId: d.burnRequestId, type: 'VOICE', destinationType: 'BURNING', presetId: d.preset.id, burnConfirmed: true, audioMimeType: d.voice.mimeType, audioByteLength: d.voice.byteLength, audioDurationMs: d.voice.durationMs } : null;
    return { requestId: d.burnRequestId, type: 'TEXT', destinationType: 'BURNING', textContent: d.text, presetId: d.preset.id, burnConfirmed: true };
  }
  beginDelivery(requestId: string, recipient: LetterRecipient): boolean {
    const d = this.snapshot.draft; const target = cleanRecipient(recipient);
    if (!d || d.stage !== 'sealed' || !d.preset || this.snapshot.save !== 'saved' || draftProblem(d) || !target || target.id === this.ownerId || !requestIdPattern.test(requestId)) return false;
    return this.commit({ ...d, stage: 'delivery-pending', deliveryRequestId: requestId.toLowerCase(), deliveryRecipient: target, deliveryReceipt: null, updatedAt: new Date().toISOString() }, true);
  }
  pendingDelivery(): PendingFriendDelivery | null {
    const d = this.snapshot.draft;
    if (!d || d.stage !== 'delivery-pending' || !d.preset || !d.deliveryRequestId || !d.deliveryRecipient) return null;
    if (d.kind === 'VOICE') return d.voice ? { requestId: d.deliveryRequestId, type: 'VOICE', destinationType: 'FRIEND', voice: d.voice, voiceCaption: d.voiceCaption.trim() || undefined, presetId: d.preset.id, recipientId: d.deliveryRecipient.id, deliveryConfirmed: true } : null;
    return { requestId: d.deliveryRequestId, type: 'TEXT', destinationType: 'FRIEND', textContent: d.text, presetId: d.preset.id, recipientId: d.deliveryRecipient.id, deliveryConfirmed: true };
  }
  chooseWorldSignature(isSigned: boolean) {
    const d = this.snapshot.draft; if (!d || d.stage !== 'sealed') return false;
    return this.commit({ ...d, worldSigned: isSigned, updatedAt: new Date().toISOString() }, true);
  }
  beginWorld(requestId: string): boolean {
    const d = this.snapshot.draft;
    if (!d || d.stage !== 'sealed' || !d.preset || this.snapshot.save !== 'saved' || draftProblem(d) || !requestIdPattern.test(requestId)) return false;
    return this.commit({ ...d, stage: 'world-pending', worldRequestId: requestId.toLowerCase(), worldReceipt: null, updatedAt: new Date().toISOString() }, true);
  }
  pendingWorld(): PendingWorldLetter | null {
    const d = this.snapshot.draft; if (!d || d.stage !== 'world-pending' || !d.preset || !d.worldRequestId) return null;
    const shared = { requestId: d.worldRequestId, destinationType: 'INFINITY' as const, presetId: d.preset.id, isSigned: d.worldSigned, publicConfirmed: true as const };
    return d.kind === 'TEXT' ? { ...shared, type: 'TEXT', textContent: d.text } : d.voice ? { ...shared, type: 'VOICE', voice: d.voice, voiceCaption: d.voiceCaption.trim() || undefined } : null;
  }
  applyWorldReceipt(value: unknown): boolean {
    const before = this.snapshot.draft; if (!before || before.stage !== 'world-pending' || !before.worldRequestId) return false;
    const receipt = readWorldReceipt(value, before.worldRequestId, before.worldSigned); if (!receipt) return false;
    if (receipt.outcome === 'REJECTED') {
      const saved = this.commit({ ...before, stage: 'sealed', worldRequestId: null, worldReceipt: null, updatedAt: new Date().toISOString() }, true);
      if (saved) this.publish({ ...this.snapshot, notice: worldRejectionMessage(receipt.reason) }); return saved;
    }
    const cleared: LetterDraft = { ...before, stage: 'published', text: '', voice: null, voiceCaption: '', voiceDeletes: [...before.voiceDeletes, ...(before.voice ? [before.voice.id] : [])], sealedAt: null, worldReceipt: receipt, updatedAt: receipt.completedAt };
    try {
      const current = this.storage.read(this.key); if (current !== null && decodeDraft(current, this.ownerId).generationId !== before.generationId) { this.load(); return true; }
      const serialized = JSON.stringify(cleared); this.storage.write(this.key, serialized); this.lastStored = serialized; this.publish({ phase: 'ready', draft: cleared, save: 'saved' }); return true;
    } catch { this.publish({ phase: 'ready', draft: cleared, save: 'error' }); return false; }
  }
  applyDeliveryReceipt(value: unknown): boolean {
    const before = this.snapshot.draft;
    if (!before || before.stage !== 'delivery-pending' || !before.deliveryRequestId || !before.deliveryRecipient) return false;
    const receipt = readDeliveryReceipt(value, before.deliveryRequestId, before.deliveryRecipient.id);
    if (!receipt) return false;
    if (receipt.outcome === 'REJECTED') {
      const restored = this.commit({ ...before, stage: 'sealed', deliveryRequestId: null, deliveryRecipient: null, deliveryReceipt: null, updatedAt: new Date().toISOString() }, true);
      if (restored) this.publish({ ...this.snapshot, notice: deliveryRejectionMessage(receipt.reason) });
      return restored;
    }
    const cleared: LetterDraft = { ...before, stage: 'delivered', text: '', voice: null, voiceCaption: '', voiceDeletes: [...before.voiceDeletes, ...(before.voice ? [before.voice.id] : [])], sealedAt: null, deliveryReceipt: receipt, updatedAt: receipt.completedAt };
    try {
      const current = this.storage.read(this.key);
      if (current !== null && decodeDraft(current, this.ownerId).generationId !== before.generationId) { this.load(); return true; }
      const serialized = JSON.stringify(cleared); this.storage.write(this.key, serialized); this.lastStored = serialized;
      this.publish({ phase: 'ready', draft: cleared, save: 'saved' }); return true;
    } catch { this.publish({ phase: 'ready', draft: cleared, save: 'error' }); return false; }
  }
  applyBurnReceipt(value: unknown): boolean {
    const before = this.snapshot.draft;
    if (!before || before.stage !== 'burn-pending' || !before.burnRequestId) return false;
    const receipt = readBurnReceipt(value, before.burnRequestId);
    if (!receipt) return false;
    if (receipt.outcome === 'REJECTED') {
      const restored = this.commit({ ...before, stage: 'sealed', burnRequestId: null, burnReceipt: null, updatedAt: new Date().toISOString() }, true);
      if (restored) this.publish({ ...this.snapshot, notice: 'That stationery is no longer available. Your letter has been kept; choose another style before releasing it.' });
      return restored;
    }
    const cleared: LetterDraft = { ...before, stage: 'burned', text: '', voice: null, voiceCaption: '', voiceDeletes: [...before.voiceDeletes, ...(before.voice ? [before.voice.id] : [])], sealedAt: null, burnReceipt: receipt, updatedAt: receipt.completedAt };
    try {
      const current = this.storage.read(this.key);
      if (current !== null && decodeDraft(current, this.ownerId).generationId !== before.generationId) {
        // A delayed response for an older page cannot erase a newer page.
        this.load();
        return true;
      }
      const serialized = JSON.stringify(cleared);
      this.storage.write(this.key, serialized);
      this.lastStored = serialized;
      this.publish({ phase: 'ready', draft: cleared, save: 'saved' });
      return true;
    } catch {
      // The persisted pending state is a fence: on restart it can only check
      // or retry the receipt, never reopen the text. Memory is cleared now.
      this.publish({ phase: 'ready', draft: cleared, save: 'error' });
      return false;
    }
  }
}

export function draftKey(ownerId: string, documentId?: string) {
  if (documentId !== undefined && !requestIdPattern.test(documentId)) throw new Error('Invalid letter identifier.');
  return documentId ? `lantern-letter-v1-${encodeURIComponent(ownerId)}--${documentId.toLowerCase()}` : `lantern-draft-v1-${encodeURIComponent(ownerId)}`;
}
