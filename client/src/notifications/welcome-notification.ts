export const WELCOME_NOTIFICATION_ID = 'lantern-welcome-v1';
export const welcomeNote = {
  title: 'Welcome to Lantern Post ✨',
  body: 'Your palace is waiting. Settle by the writing desk and leave a little light in the world.',
  data: { type: 'PALACE_WELCOME' },
};
export interface WelcomePort {
  available(): boolean;
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  permission(ask: boolean): Promise<boolean>;
  exists(): Promise<boolean>;
  schedule(): Promise<void>;
}
export type WelcomeResult = 'unavailable' | 'complete' | 'permission-needed';
// Shared by first launch and an explicit retry in settings. The marker belongs
// to the installation, not an account, and contains no personal information.
export class WelcomeNotification {
  private pending: Promise<WelcomeResult> | null = null;
  constructor(private port: WelcomePort) {}
  ensure(manual = false): Promise<WelcomeResult> {
    if (!this.pending) this.pending = this.run(manual).finally(() => { this.pending = null; });
    return this.pending;
  }
  private async run(manual: boolean): Promise<WelcomeResult> {
    if (!this.port.available()) return 'unavailable';
    const marker = await this.port.read();
    if (marker === 'complete') return 'complete';
    // Record the permission attempt before prompting so denial/relaunch never
    // causes repeated automatic permission requests.
    if (marker === null) await this.port.write('asked');
    if (!await this.port.permission(marker === null || manual)) return 'permission-needed';
    if (!await this.port.exists()) await this.port.schedule();
    await this.port.write('complete');
    return 'complete';
  }
}
