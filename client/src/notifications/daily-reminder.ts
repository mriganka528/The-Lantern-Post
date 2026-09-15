export const DAILY_REMINDER_ID = 'lantern-daily-reminder-v1';
export const dailyReminderKey = (ownerId: string) => 'lantern-daily-reminder-v1-' + encodeURIComponent(ownerId);
export interface ReminderPreference { enabled: boolean; hour: number; minute: number }
export const defaultReminder: ReminderPreference = { enabled: true, hour: 19, minute: 0 };
export const dailyReminderNote = {
  title: 'A little light is waiting',
  body: 'Your palace is open. Write a few words, visit a friend, or leave a thought among the stars.',
};
export function parseReminderPreference(raw: string | null): ReminderPreference {
  if (raw === null) return { ...defaultReminder };
  const value = JSON.parse(raw) as ReminderPreference & { version: number };
  if (!value || value.version !== 1 || typeof value.enabled !== 'boolean' || !Number.isInteger(value.hour) || value.hour < 0 || value.hour > 23 || !Number.isInteger(value.minute) || value.minute < 0 || value.minute > 59) throw Error('Invalid reminder preference');
  return { enabled: value.enabled, hour: value.hour, minute: value.minute };
}
export interface ScheduledReminder { ownerId: string; hour: number; minute: number; timezone: string }
export interface DailyReminderPort {
  available(): boolean;
  read(ownerId: string): ReminderPreference;
  write(ownerId: string, preference: ReminderPreference): void;
  closed(ownerId: string): boolean;
  permission(ask: boolean): Promise<boolean>;
  scheduled(): Promise<ScheduledReminder | null>;
  schedule(reminder: ScheduledReminder): Promise<void>;
  cancel(): Promise<void>;
  timezone(): string;
}
export interface DailyReminderState {
  ownerId: string | null;
  preference: ReminderPreference;
  status: 'loading' | 'off' | 'scheduled' | 'permission-needed' | 'unavailable' | 'error';
}

// One device schedule, serialized across permission prompts, account changes
// and settings updates. Preferences remain private to each local account.
export class DailyReminder {
  private state: DailyReminderState = { ownerId: null, preference: defaultReminder, status: 'loading' };
  private listeners = new Set<() => void>();
  private owner: string | null = null;
  private revision = 0;
  private session = 0;
  private queue: Promise<void> = Promise.resolve();
  constructor(private port: DailyReminderPort) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(next: DailyReminderState) { this.state = next; this.listeners.forEach(listener => listener()); }
  activate(ownerId: string | null) {
    const session = ++this.session;
    this.owner = ownerId; this.revision++;
    this.publish({ ownerId, preference: defaultReminder, status: 'loading' });
    void this.sync();
    return () => { if (session === this.session) { this.owner = null; this.revision++; void this.sync(); } };
  }
  sync(ask = false): Promise<void> {
    const owner = this.owner, revision = this.revision;
    const valid = () => revision === this.revision && owner === this.owner;
    const allowed = () => valid() && owner !== null && !this.port.closed(owner);
    this.queue = this.queue.catch(() => {}).then(async () => {
      if (!valid()) return;
      try {
        if (!this.port.available()) { this.publish({ ...this.state, status: 'unavailable' }); return; }
        const existing = await this.port.scheduled();
        if (!valid()) return;
        if (!allowed()) { await this.port.cancel(); if (valid()) this.publish({ ...this.state, status: 'off' }); return; }
        const preference = this.port.read(owner!);
        this.publish({ ownerId: owner, preference, status: 'loading' });
        if (existing && existing.ownerId !== owner) await this.port.cancel();
        if (!allowed()) return;
        if (!preference.enabled) { await this.port.cancel(); if (valid()) this.publish({ ownerId: owner, preference, status: 'off' }); return; }
        const permission = await this.port.permission(ask);
        if (!allowed()) return;
        if (!permission) { await this.port.cancel(); if (valid()) this.publish({ ownerId: owner, preference, status: 'permission-needed' }); return; }
        const timezone = this.port.timezone();
        if (!existing || existing.ownerId !== owner || existing.hour !== preference.hour || existing.minute !== preference.minute || existing.timezone !== timezone) {
          await this.port.cancel();
          if (!allowed()) return;
          await this.port.schedule({ ownerId: owner!, hour: preference.hour, minute: preference.minute, timezone });
          // A late native result may not restore a signed-out/closed account.
          if (!allowed()) { await this.port.cancel(); return; }
        }
        this.publish({ ownerId: owner, preference, status: 'scheduled' });
      } catch { if (valid()) this.publish({ ...this.state, status: 'error' }); }
    });
    return this.queue;
  }
  async update(ownerId: string, preference: ReminderPreference) {
    if (ownerId !== this.owner || this.port.closed(ownerId)) throw Error('Reminder account changed');
    const checked = parseReminderPreference(JSON.stringify({ version: 1, ...preference }));
    this.port.write(ownerId, checked); // A failed write leaves the existing schedule intact.
    this.revision++;
    await this.sync(checked.enabled);
  }
  async eraseOwner(ownerId: string) {
    if (!this.port.available()) return;
    if (this.owner === ownerId) { this.owner = null; this.revision++; }
    this.queue = this.queue.catch(() => {}).then(async () => {
      if ((await this.port.scheduled())?.ownerId === ownerId) await this.port.cancel();
    });
    return this.queue;
  }
}
