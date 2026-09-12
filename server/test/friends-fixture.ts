// Isolated, in-memory Prisma provider for HTTP/browser tests. It never loads
// server/.env, accepts real Clerk tokens, or contacts a database/push provider.
import 'reflect-metadata';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { FriendsModule } from '../src/friends/friends.module';
import { NotificationsModule } from '../src/notifications/notifications.module';
import { NotificationsService } from '../src/notifications/notifications.service';
import { PrismaService } from '../src/database/prisma.service';
import { ClerkTokenVerifier } from '../src/auth/clerk-token-verifier.service';
import { configureApp } from '../src/configure-app';
import { validateEnvironment } from '../src/config/environment';
import { LettersModule } from '../src/letters/letters.module';
import { LetterModerationService } from '../src/letters/letter-moderation.service';

type Row = Record<string, unknown>;
type Args = { where?: Row; select?: Row; data?: Row; create?: Row; update?: Row; orderBy?: Row | Row[]; take?: number; skip?: number };
export function friendsFixture() {
  const state = { users: [] as Row[], requests: [] as Row[], jobs: [] as Row[], tokens: [] as Row[], blocks: [] as Row[], letters: [] as Row[], receipts: [] as Row[], presets: [] as Row[], calls: 0, next: 0, failJob: false, failReceipt: false, conflicts: 0 };
  const character = { id: 'char_fox_lantern', key: 'fox-lantern', displayName: 'Ember', assetUrl: 'bundled://characters/fox-lantern', secret: 'private-character' };
  const user = (name: string) => ({ id: `owner-${name}`, username: name, authProviderId: name, characterId: character.id, character, privateField: 'must-not-leak', createdAt: new Date('2026-01-01') });
  function reset() {
    state.users = ['alice', 'bob', 'carol', 'bert'].map(user); state.users[3]!.characterId = null; state.users[3]!.character = null;
    state.requests = []; state.jobs = []; state.tokens = []; state.blocks = []; state.letters = []; state.receipts = []; state.calls = 0; state.next = 0; state.failJob = false; state.failReceipt = false; state.conflicts = 0;
    state.presets = [{ id: 'preset_lantern', key: 'lantern-parchment', displayName: 'Royal ivory', isActive: true, configJson: { version: 1, order: 0, description: 'Ivory paper from the royal cabinet.', paperColor: '#F0DDB5', inkColor: '#493622', sealColor: '#874B36', ribbonColor: '#899069', texture: 'parchment', motif: 'royal', font: 'book' } }];
  }
  reset();
  const conflict = (code = 'P2002') => new Prisma.PrismaClientKnownRequestError('Synthetic conflict', { code, clientVersion: '6.19.3' });
  const fullUser = (row: Row) => ({ ...row, blockedUsers: state.blocks.filter(b => b.blockerId === row.id), blockedByUsers: state.blocks.filter(b => b.blockedId === row.id), friendRequestsSent: state.requests.filter(r => r.fromUserId === row.id), friendRequestsReceived: state.requests.filter(r => r.toUserId === row.id) });
  const full = (table: string, row: Row): Row => table === 'users' ? fullUser(row) : table === 'requests' ? { ...row, fromUser: fullUser(state.users.find(u => u.id === row.fromUserId)!), toUser: fullUser(state.users.find(u => u.id === row.toUserId)!) } : table === 'letters' ? { ...row, sender: fullUser(state.users.find(u => u.id === row.senderId)!), recipient: row.recipientId ? fullUser(state.users.find(u => u.id === row.recipientId)!) : null } : row;
  const scalar = (v: unknown): string | number | boolean | null | undefined => v instanceof Date ? v.getTime() : v as string | number | boolean | null | undefined;
  function matches(row: Row, where: Row = {}): boolean {
    return Object.entries(where).every(([key, expected]) => {
      if (key === 'AND' || key === 'OR') { const items = Array.isArray(expected) ? expected : [expected]; return key === 'AND' ? items.every(w => matches(row, w as Row)) : items.some(w => matches(row, w as Row)); }
      const actual = row[key];
      if (expected instanceof Date || expected === null || typeof expected !== 'object') return scalar(actual) === scalar(expected);
      const operation = expected as Row;
      if ('none' in operation || 'some' in operation) { const rows = actual as Row[]; return 'none' in operation ? rows.every(item => !matches(item, operation.none as Row)) : rows.some(item => matches(item, operation.some as Row)); }
      if (['not', 'in', 'startsWith', 'gt', 'gte', 'lt', 'lte'].some(k => k in operation)) return Object.entries(operation).every(([op, v]) => {
        if (op === 'not') return scalar(actual) !== scalar(v);
        if (op === 'in') return (v as unknown[]).includes(actual);
        if (op === 'startsWith') return String(actual).startsWith(String(v).replace(/\\([\\%_])/g, '$1'));
        if (actual === null || actual === undefined) return false;
        if (op === 'gt') return scalar(actual)! > scalar(v)!;
        if (op === 'gte') return scalar(actual)! >= scalar(v)!;
        if (op === 'lt') return scalar(actual)! < scalar(v)!;
        return scalar(actual)! <= scalar(v)!;
      });
      return actual !== null && typeof actual === 'object' && matches(actual as Row, operation);
    });
  }
  function project(row: Row | undefined, select?: Row): Row | null {
    if (!row) return null;
    if (!select) return structuredClone(row);
    return Object.fromEntries(Object.entries(select).map(([key, spec]) => [key, spec === true ? row[key] : row[key] ? project(row[key] as Row, (spec as { select: Row }).select) : null]));
  }
  function model(table: 'users' | 'requests' | 'jobs' | 'tokens' | 'letters' | 'receipts' | 'presets') {
    const find = (args: Args = {}) => {
      state.calls++;
      let rows = state[table].map(r => full(table, r)).filter(row => matches(row, args.where));
      const orders = args.orderBy ? Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy] : [];
      rows = rows.sort((a, b) => { for (const order of orders) for (const [key, dir] of Object.entries(order)) { const left = scalar(a[key])!; const right = scalar(b[key])!; if (left !== right) return (left > right ? 1 : -1) * (dir === 'desc' ? -1 : 1); } return 0; });
      return rows.slice(args.skip ?? 0, args.take === undefined ? undefined : (args.skip ?? 0) + args.take);
    };
    const assign = (row: Row, data: Row = {}) => { for (const [k, v] of Object.entries(data)) row[k] = v === Prisma.DbNull ? null : v && typeof v === 'object' && 'increment' in v ? Number(row[k]) + Number(v.increment) : v; };
    const create = async ({ data = {}, select }: Args) => {
      state.calls++;
      if (table === 'jobs' && state.failJob) throw new Error('Synthetic private outbox failure');
      if (table === 'receipts' && state.failReceipt) throw new Error('Synthetic private receipt failure');
      if (table === 'requests' && state.requests.some(r => [r.fromUserId, r.toUserId].includes(data.fromUserId) && [r.fromUserId, r.toUserId].includes(data.toUserId))) throw conflict();
      if (['jobs', 'letters', 'receipts'].includes(table) && state[table].some(r => r.id === data.id)) throw conflict();
      const row: Row = { id: `cfixture${String(++state.next).padStart(6, '0')}`, createdAt: new Date(),
        ...(table === 'requests' ? { status: 'PENDING', respondedAt: null } : {}), ...(table === 'jobs' ? { availableAt: new Date(), claimedUntil: null, attempts: 0, completedAt: null, requestId: null, letterId: null } : {}),
        ...(table === 'letters' ? { type: 'TEXT', status: 'SENDING', recipientId: null, textContent: null, audioUrl: null, stationeryJson: null, deliveredAt: null, readAt: null, moderationPassed: null } : {}),
        ...(table === 'receipts' ? { reason: null, letterId: null } : {}), ...data };
      state[table].push(row); return project(full(table, row), select)!;
    };
    const update = async ({ where, data, select }: Args) => {
      const row = state[table].find(r => matches(full(table, r), where)); if (!row) throw conflict('P2025'); assign(row, data); return project(full(table, row), select)!;
    };
    return {
      findUnique: async (args: Args) => project(find(args)[0], args.select), findFirst: async (args: Args) => project(find(args)[0], args.select),
      findMany: async (args: Args = {}) => find(args).map(r => project(r, args.select)!), count: async (args: Args = {}) => find(args).length,
      create, update, updateMany: async ({ where, data }: Args) => { const rows = state[table].filter(r => matches(full(table, r), where)); rows.forEach(r => assign(r, data)); return { count: rows.length }; },
      delete: async ({ where }: Args) => { const row = state[table].find(r => matches(full(table, r), where)); if (!row) throw conflict('P2025'); state[table] = state[table].filter(r => r !== row); if (table === 'requests') state.jobs = state.jobs.filter(j => j.requestId !== row.id); return row; },
      deleteMany: async ({ where }: Args) => { const before = state[table].length; state[table] = state[table].filter(r => !matches(full(table, r), where)); return { count: before - state[table].length }; },
      upsert: async (args: Args) => find(args).length ? update({ ...args, data: args.update }) : create({ ...args, data: args.create }),
    };
  }
  let queue = Promise.resolve();
  const models = { user: model('users'), friendRequest: model('requests'), friendNotification: model('jobs'), pushToken: model('tokens'), letter: model('letters'), deliveryReceipt: model('receipts'), preset: model('presets') };
  const database = { ...models, $transaction: async (operation: (tx: typeof models) => Promise<unknown>) => {
    if (state.conflicts > 0) { state.conflicts--; throw conflict('P2034'); }
    let release = () => {}; const before = queue; queue = new Promise<void>(resolve => { release = resolve; }); await before;
    const snapshot = structuredClone({ requests: state.requests, jobs: state.jobs, tokens: state.tokens, letters: state.letters, receipts: state.receipts });
    try { return await operation(models); } catch (error) { Object.assign(state, snapshot); throw error; } finally { release(); }
  } };
  return { state, database, reset, user };
}
export async function createFriendsTestApp(pushEnabled = false, moderation?: Pick<LetterModerationService, 'available' | 'check'>) {
  const fixture = friendsFixture();
  const builder = Test.createTestingModule({ imports: [FriendsModule, NotificationsModule, LettersModule] })
    .overrideProvider(ConfigService).useValue(new ConfigService(validateEnvironment({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://localhost:5432/test', EXPO_PUSH_ENABLED: String(pushEnabled) })))
    .overrideProvider(PrismaService).useValue(fixture.database)
    .overrideProvider(ClerkTokenVerifier).useValue({ verify: async (token: string) => { if (!['alice', 'bob', 'carol', 'bert', 'new-user'].includes(token)) throw new UnauthorizedException(); return { subject: token, sessionId: `fixture-${token}` }; } });
  if (moderation) builder.overrideProvider(LetterModerationService).useValue(moderation);
  const module = await builder.compile();
  const app = module.createNestApplication({ logger: false }); configureApp(app); await app.listen(0, '127.0.0.1');
  // Tests drive dispatch explicitly; never leave a timer that could send push.
  const notifications = app.get(NotificationsService); notifications.onModuleDestroy();
  return { app, url: await app.getUrl(), fixture, notifications };
}
