import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DailyReminder, dailyReminderKey, defaultReminder, parseReminderPreference } from '../src/notifications/daily-reminder';
import type { DailyReminderPort, ReminderPreference, ScheduledReminder } from '../src/notifications/daily-reminder';
import { assertPrivateWrite, closedAccountKey, privateKeyOwner } from '../src/account/local-privacy';

function fixture() {
  const preferences = new Map<string, ReminderPreference>(), closed = new Set<string>();
  let scheduled: ScheduledReminder | null = null, allowed = true, failWrite = false, failCancel = false, zone = 'Asia/Kolkata', calls = 0;
  const prompts: boolean[] = [];
  const port: DailyReminderPort = {
    available: () => true, read: owner => preferences.get(owner) ?? { ...defaultReminder },
    write: (owner, value) => { if (failWrite) throw Error('Unavailable storage'); preferences.set(owner, value); },
    closed: owner => closed.has(owner), permission: async ask => { prompts.push(ask); return allowed; },
    scheduled: async () => scheduled,
    schedule: async value => { calls++; scheduled = value; },
    cancel: async () => { if (failCancel) throw Error('Device busy'); scheduled = null; },
    timezone: () => zone,
  };
  const reminder = new DailyReminder(port);
  return { reminder, port, preferences, closed, prompts, scheduled: () => scheduled, calls: () => calls, permission: (value: boolean) => { allowed = value; }, failWrite: (value: boolean) => { failWrite = value; }, failCancel: (value: boolean) => { failCancel = value; }, timezone: (value: string) => { zone = value; } };
}
test('daily reminder defaults to local 7 PM, never auto-prompts, and keeps just one schedule', async () => {
  const f = fixture(); f.reminder.activate('alice'); await f.reminder.sync();
  assert.deepEqual(f.scheduled(), { ownerId: 'alice', hour: 19, minute: 0, timezone: 'Asia/Kolkata' });
  await Promise.all([f.reminder.sync(), f.reminder.sync()]); assert.equal(f.calls(), 1);
  assert.ok(f.prompts.every(ask => !ask));
  f.timezone('Europe/London'); await f.reminder.sync(); assert.equal(f.calls(), 2); assert.equal(f.scheduled()?.timezone, 'Europe/London');
});
test('permission denial, later OS acceptance, time changes and persistent opt-out', async () => {
  const f = fixture(); f.permission(false); f.reminder.activate('alice'); await f.reminder.sync();
  assert.equal(f.scheduled(), null); assert.equal(f.reminder.getSnapshot().status, 'permission-needed');
  f.permission(true); await f.reminder.sync(); assert.equal(f.calls(), 1);
  await f.reminder.update('alice', { enabled: true, hour: 9, minute: 0 }); assert.equal(f.scheduled()?.hour, 9); assert.equal(f.prompts.at(-1), true);
  await f.reminder.update('alice', { enabled: false, hour: 9, minute: 0 }); assert.equal(f.scheduled(), null);
  f.reminder.activate('alice'); await f.reminder.sync(); assert.equal(f.scheduled(), null); assert.equal(f.reminder.getSnapshot().status, 'off');
});
test('sign-out cancels reminders; account preferences and erasure stay isolated', async () => {
  const f = fixture(); const stopAlice = f.reminder.activate('alice'); await f.reminder.sync();
  await f.reminder.update('alice', { enabled: false, hour: 9, minute: 0 });
  const stopBob = f.reminder.activate('bob'); stopAlice(); await f.reminder.sync(); assert.equal(f.scheduled()?.ownerId, 'bob');
  await f.reminder.eraseOwner('alice'); assert.equal(f.scheduled()?.ownerId, 'bob');
  stopBob(); await f.reminder.sync(); assert.equal(f.scheduled(), null);
  f.reminder.activate('alice'); await f.reminder.sync(); assert.equal(f.scheduled(), null);
});
test('a late native schedule cannot survive account closure', async () => {
  const f = fixture(); let release!: () => void;
  const scheduled = f.port.schedule;
  f.port.schedule = async value => { await new Promise<void>(resolve => { release = resolve; }); await scheduled(value); };
  f.reminder.activate('alice'); const pending = f.reminder.sync();
  while (!release) await new Promise(resolve => setImmediate(resolve));
  f.closed.add('alice'); const cleanup = f.reminder.eraseOwner('alice'); release();
  await pending; await cleanup; assert.equal(f.scheduled(), null);
});
test('a permission result arriving after sign-out cannot create a reminder', async () => {
  const f = fixture(); let release!: (value: boolean) => void;
  f.port.permission = () => new Promise<boolean>(resolve => { release = resolve; });
  const stop = f.reminder.activate('alice'); const pending = f.reminder.sync();
  while (!release) await new Promise(resolve => setImmediate(resolve));
  stop(); release(true); await pending; await f.reminder.sync();
  assert.equal(f.scheduled(), null); assert.equal(f.calls(), 0);
});
test('storage and cancellation failures remain retryable without silently resetting choices', async () => {
  const f = fixture(); f.reminder.activate('alice'); await f.reminder.sync(); f.failWrite(true);
  await assert.rejects(f.reminder.update('alice', { enabled: false, hour: 19, minute: 0 })); assert.equal(f.scheduled()?.hour, 19);
  f.failWrite(false); f.failCancel(true); await f.reminder.update('alice', { enabled: false, hour: 19, minute: 0 });
  assert.equal(f.reminder.getSnapshot().status, 'error'); assert.equal(f.preferences.get('alice')?.enabled, false);
  f.failCancel(false); await f.reminder.sync(); assert.equal(f.scheduled(), null); assert.equal(f.reminder.getSnapshot().status, 'off');
});
test('corrupt preferences are not reset, closed accounts cannot write, and unsupported apps do not schedule', async () => {
  assert.deepEqual(parseReminderPreference(null), defaultReminder);
  for (const raw of ['null', '{}', '{', JSON.stringify({ version: 1, enabled: true, hour: 24, minute: 0 })]) assert.throws(() => parseReminderPreference(raw));
  assert.equal(privateKeyOwner(dailyReminderKey('alice')), 'alice');
  assert.throws(() => assertPrivateWrite(dailyReminderKey('alice'), key => key === closedAccountKey('alice') ? 'closed' : null));
  const f = fixture(); f.port.available = () => false; f.reminder.activate('alice'); await f.reminder.sync(); assert.equal(f.calls(), 0); assert.equal(f.prompts.length, 0);
});
