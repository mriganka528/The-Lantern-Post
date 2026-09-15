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
  { id: 'guidance', title: 'A lantern when you need one', text: 'Guidance stays here for you. Replay this walk from this section or your account menu. After this first visit, it opens only when you choose.', icon: 'gate' },
] as const;
export type GuidanceTargetId = typeof guidanceSteps[number]['id'];
export type GuidanceStep = typeof guidanceSteps[number];
