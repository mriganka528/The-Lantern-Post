export const GUIDANCE_KEY = 'lantern-guidance-v1';
export type GuidanceOutcome = 'seen' | 'skipped' | 'complete';
export interface GuidanceStorage { read(): string | null; write(value: GuidanceOutcome): void }

// Installation preference only: no identity, letter, message or progress data.
// Mark presentation before showing the tour, so an interrupted visit is not forced again.
export class GuidancePreference {
  private attempted = false;
  private unsaved: GuidanceOutcome | null = null;
  constructor(private readonly storage: GuidanceStorage) {}
  claimAutomatic(): boolean {
    if (this.attempted) return false;
    this.attempted = true;
    try { if (this.storage.read() !== null) return false; }
    catch { return false; }
    this.mark('seen');
    return true;
  }
  mark(outcome: GuidanceOutcome): boolean {
    this.attempted = true;
    this.unsaved = outcome;
    try { this.storage.write(outcome); this.unsaved = null; return true; }
    catch { return false; }
  }
  retry(): boolean { return this.unsaved === null || this.mark(this.unsaved); }
  get needsRetry() { return this.unsaved !== null; }
}

export const guidanceSteps = [
  { id: 'companions', title: 'A companion for your story', text: 'Meet the companions here. Each brings a different palace, and keeps you company as you write or record. You can choose another whenever you like.', icon: 'star' },
  { id: 'writing', title: 'Your words begin here', text: 'Open the writing desk to write or record. Choose antique stationery, keep several letters in My letters, or start a new one. Sealing alone never sends.', icon: 'letter' },
  { id: 'friends', title: 'A gate to your people', text: 'Find friends by username and invite them here. Once they accept, open their gate to send a letter or talk live in the message parlour.', icon: 'key' },
  { id: 'letterbox', title: 'A little post, just for you', text: 'Open the palace letterbox to read letters and listen to voices from your friends. Removing a letter from your side leaves their copy with them.', icon: 'letter' },
  { id: 'infinity', title: 'A sky of shared stories', text: 'Enter the Infinity World to explore and open little letter stars. It begins at night, with a day-view switch. Shared letters are unsigned unless you choose to sign.', icon: 'star' },
  { id: 'fire', title: 'For words ready to rest', text: 'The Burning World is reached from a sealed letter at your desk. Confirm only when you are ready: a completed burn cannot be undone. You can skip the ceremony.', icon: 'moon' },
  { id: 'bell', title: 'Listen for the palace bell', text: 'New letters, messages and invitations gather here. On your phone, allow notifications when asked if you would like arrival alerts outside the app.', icon: 'bell' },
  { id: 'account', title: 'Your own little corner', text: 'Share your username, manage arrival alerts, and open Chat backups & privacy here. Backups are optional; keep your recovery key safely with you.', icon: 'key' },
  { id: 'guidance', title: 'A lantern when you need one', text: 'Guidance stays here for you. Replay this walk from this section or the Guidance button above. After this first visit, it opens only when you choose.', icon: 'gate' },
] as const;
export type GuidanceTargetId = typeof guidanceSteps[number]['id'];
export type GuidanceStep = typeof guidanceSteps[number];
export interface GuidanceRect { x: number; y: number; width: number; height: number }
export interface GuidanceViewport { width: number; height: number; top: number; bottom: number }
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(n, Math.max(min, max)));

export function guidancePlacement(target: GuidanceRect, viewport: GuidanceViewport, fontScale = 1, contentHeight?: number) {
  const margin = 12, gap = 18;
  const top = viewport.top + margin, bottom = viewport.height - viewport.bottom - margin;
  const usable = Math.max(1, bottom - top);
  const panelWidth = Math.min(380, Math.max(1, viewport.width - margin * 2));
  const desiredHeight = Math.min(360, contentHeight === undefined ? 268 + Math.max(0, fontScale - 1) * 100 : contentHeight + 87);
  const focusHeight = Math.max(1, Math.min(target.height + 12, usable - Math.min(usable * .65, desiredHeight) - gap));
  const focus = {
    x: clamp(target.x - 6, 6, viewport.width - 7),
    y: clamp(target.y - 6, top, bottom - focusHeight),
    width: Math.min(target.width + 12, viewport.width - 12),
    height: focusHeight,
  };
  focus.width = Math.max(1, Math.min(focus.width, viewport.width - 6 - focus.x));
  const above = focus.y - top - gap, below = bottom - focus.y - focus.height - gap;
  const side = below >= desiredHeight || below >= above ? 'below' : 'above';
  const room = side === 'below' ? below : above;
  const panelHeight = Math.max(1, Math.min(desiredHeight, room));
  const panel = {
    x: clamp(focus.x + focus.width / 2 - panelWidth / 2, margin, viewport.width - panelWidth - margin),
    y: side === 'below' ? focus.y + focus.height + gap : focus.y - gap - panelHeight,
    width: panelWidth, height: panelHeight,
  };
  // Point to the actual highlighted area, even when the panel is clamped at an edge.
  const pointerX = clamp(focus.x + focus.width / 2, panel.x + 20, panel.x + panel.width - 20);
  return { focus, panel, side, pointerX };
}
