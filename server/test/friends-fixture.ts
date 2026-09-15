import { PalaceEvents } from '../src/realtime/palace-events';
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
import { VoiceAssetsService } from '../src/voice/voice-assets.service';
import { VoiceStorageService } from '../src/voice/voice-storage.service';
import { SafetyModule } from '../src/safety/safety.module';
import { RequestLimits } from '../src/safety/request-limits';
import { DiagnosticsModule } from '../src/diagnostics/diagnostics.module';
import { DiagnosticsService } from '../src/diagnostics/diagnostics.service';
import { RetentionModule } from '../src/retention/retention.module';
import { RetentionService } from '../src/retention/retention.service';
import { CharactersModule } from '../src/characters/characters.module';
import { PresetsModule } from '../src/presets/presets.module';
import { AccountModule } from '../src/account/account.module';
import { AccountService } from '../src/account/account.service';
import { IdentityRemoval } from '../src/account/identity-removal';
import { ChatModule } from '../src/chat/chat.module';

type Row = Record<string, unknown>;
type Args = { _sum?: Row; where?: Row; select?: Row; data?: Row; create?: Row; update?: Row; orderBy?: Row | Row[]; take?: number; skip?: number };
export function friendsFixture() {
  const state = { events: [] as Row[], deletions: [] as Row[], driveConnections: [] as Row[], driveLinks: [] as Row[], chatThreads: [] as Row[], chatMessages: [] as Row[], chatReceipts: [] as Row[], chatReports: [] as Row[], users: [] as Row[], characters: [] as Row[], diagnostics: [] as Row[], requests: [] as Row[], jobs: [] as Row[], tokens: [] as Row[], blocks: [] as Row[], letters: [] as Row[], receipts: [] as Row[], worldReceipts: [] as Row[], burnReceipts: [] as Row[], voiceAssets: [] as Row[], presets: [] as Row[], reports: [] as Row[], budgets: [] as Row[], calls: 0, next: 0, failJob: false, failReceipt: false, conflicts: 0 };
  const character = { id: 'char_fox_lantern', key: 'fox-lantern', displayName: 'Ember', assetUrl: 'bundled://characters/fox-lantern', isActive: true, secret: 'private-character' };
  const user = (name: string) => ({ id: `owner-${name}`, username: name, authProviderId: name, accountState: 'ACTIVE', realtimeSequence:0, characterId: character.id, character, diagnosticsEnabled: false, diagnosticsKey: null, diagnosticsSince: null, privateField: 'must-not-leak', createdAt: new Date('2026-01-01') });
  function reset() {
    state.users = ['alice', 'bob', 'carol', 'bert'].map(user); state.users[3]!.characterId = null; state.users[3]!.character = null;
    state.events=[]; state.deletions = []; state.driveConnections = []; state.driveLinks = []; state.chatThreads = []; state.chatMessages = []; state.chatReceipts = []; state.chatReports = [];
    state.characters = [{ ...character }]; state.diagnostics = [];
    state.requests = []; state.jobs = []; state.tokens = []; state.blocks = []; state.letters = []; state.receipts = []; state.worldReceipts = []; state.burnReceipts = []; state.voiceAssets = []; state.reports = []; state.budgets = []; state.calls = 0; state.next = 0; state.failJob = false; state.failReceipt = false; state.conflicts = 0;
    state.presets = [{ id: 'preset_lantern', key: 'lantern-parchment', displayName: 'Royal ivory', isActive: true, configJson: { version: 1, order: 0, description: 'Ivory paper from the royal cabinet.', paperColor: '#F0DDB5', inkColor: '#493622', sealColor: '#874B36', ribbonColor: '#899069', texture: 'parchment', motif: 'royal', font: 'book' } }];
  }
  reset();
  const conflict = (code = 'P2002') => new Prisma.PrismaClientKnownRequestError('Synthetic conflict', { code, clientVersion: '6.19.3' });
  const fullUser = (row: Row) => ({ ...row, character: row.characterId ? state.characters.find(c => c.id === row.characterId) ?? row.character : null, blockedUsers: state.blocks.filter(b => b.blockerId === row.id), blockedByUsers: state.blocks.filter(b => b.blockedId === row.id), friendRequestsSent: state.requests.filter(r => r.fromUserId === row.id), friendRequestsReceived: state.requests.filter(r => r.toUserId === row.id) });
  const full = (table: string, row: Row): Row => table === 'users' ? fullUser(row) : table === 'requests' ? { ...row, fromUser: fullUser(state.users.find(u => u.id === row.fromUserId)!), toUser: fullUser(state.users.find(u => u.id === row.toUserId)!) } : table === 'letters' ? { ...row, sender: fullUser(state.users.find(u => u.id === row.senderId)!), recipient: row.recipientId ? fullUser(state.users.find(u => u.id === row.recipientId)!) : null, voiceAsset: state.voiceAssets.find(a => a.id === row.voiceAssetId) ?? null, reports: state.reports.filter(r => r.letterId === row.id) } : table === 'chatMessages' ? { ...row, sender:fullUser(state.users.find(u=>u.id===row.senderId)!), thread: state.chatThreads.find(t => t.id === row.threadId) } : row;
  const scalar = (v: unknown): string | number | boolean | null | undefined => v instanceof Date ? v.getTime() : v as string | number | boolean | null | undefined;
  function matches(row: Row, where: Row = {}): boolean {
    return Object.entries(where).every(([key, expected]) => {
      if (key === 'AND' || key === 'OR') { const items = Array.isArray(expected) ? expected : [expected]; return key === 'AND' ? items.every(w => matches(row, w as Row)) : items.some(w => matches(row, w as Row)); }
      const actual = row[key];
      if (expected instanceof Date || expected === null || typeof expected !== 'object') return scalar(actual) === scalar(expected);
      const operation = expected as Row;
      if ('none' in operation || 'some' in operation) { const rows = actual as Row[]; return 'none' in operation ? rows.every(item => !matches(item, operation.none as Row)) : rows.some(item => matches(item, operation.some as Row)); }
      if (['not', 'in', 'startsWith', 'contains', 'gt', 'gte', 'lt', 'lte'].some(k => k in operation)) return Object.entries(operation).every(([op, v]) => {
        if (op === 'not') return scalar(actual) !== scalar(v);
        if (op === 'in') return (v as unknown[]).includes(actual);
        if (op === 'startsWith') return String(actual).startsWith(String(v).replace(/\\([\\%_])/g, '$1'));
        if (op === 'contains') return String(actual).includes(String(v).replace(/\\([\\%_])/g, '$1'));
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
  function model(table: 'events' | 'deletions' | 'driveConnections' | 'driveLinks' | 'users' | 'characters' | 'diagnostics' | 'requests' | 'jobs' | 'tokens' | 'letters' | 'receipts' | 'worldReceipts' | 'presets' | 'burnReceipts' | 'voiceAssets' | 'blocks' | 'reports' | 'budgets' | 'chatThreads' | 'chatMessages' | 'chatReceipts' | 'chatReports') {
    const find = (args: Args = {}) => {
      state.calls++;
      let rows = state[table].map(r => table === 'blocks' ? { ...r, blocked: fullUser(state.users.find(u => u.id === r.blockedId)!) } : full(table, r)).filter(row => matches(row, args.where));
      const orders = args.orderBy ? Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy] : [];
      rows = rows.sort((a, b) => { for (const order of orders) for (const [key, dir] of Object.entries(order)) { const left = scalar(a[key])!; const right = scalar(b[key])!; if (left !== right) return (left > right ? 1 : -1) * (dir === 'desc' ? -1 : 1); } return 0; });
      return rows.slice(args.skip ?? 0, args.take === undefined ? undefined : (args.skip ?? 0) + args.take);
    };
    const assign = (row: Row, data: Row = {}) => { for (const [k, v] of Object.entries(data)) row[k] = v === Prisma.DbNull ? null : v && typeof v === 'object' && 'increment' in v ? Number(row[k]) + Number(v.increment) : v; };
    const create = async ({ data = {}, select }: Args) => {
      state.calls++;
      if (table === 'jobs' && state.failJob) throw new Error('Synthetic private outbox failure');
      if (['receipts', 'worldReceipts', 'chatReceipts'].includes(table) && state.failReceipt) throw new Error('Synthetic receipt failure');
      if (table === 'requests' && state.requests.some(r => [r.fromUserId, r.toUserId].includes(data.fromUserId) && [r.fromUserId, r.toUserId].includes(data.toUserId))) throw conflict();
      if (['jobs', 'letters', 'receipts', 'worldReceipts', 'burnReceipts', 'voiceAssets'].includes(table) && state[table].some(r => r.id === data.id)) throw conflict();
      if (['blocks', 'reports', 'budgets'].includes(table) && state[table].some(r => r.id === data.id)) throw conflict();
      if (['chatThreads', 'chatMessages', 'chatReceipts', 'chatReports'].includes(table) && state[table].some(r => r.id === data.id)) throw conflict();
      if (table === 'chatMessages' && state.chatMessages.some(r => r.threadId === data.threadId && r.sequence === data.sequence)) throw conflict();
      const row: Row = { id: `cfixture${String(++state.next).padStart(6, '0')}`, createdAt: new Date(),
        ...(table === 'requests' ? { status: 'PENDING', respondedAt: null } : {}), ...(table === 'jobs' ? { availableAt: new Date(), claimedUntil: null, attempts: 0, completedAt: null, requestId: null, letterId: null, chatMessageId:null } : {}),
        ...(table === 'letters' ? { type: 'TEXT', status: 'SENDING', recipientId: null, textContent: null, voiceCaption: null, audioUrl: null, audioDurationMs: null, voiceAssetId: null, stationeryJson: null, deliveredAt: null, readAt: null, senderDeletedAt:null, recipientDeletedAt:null, moderationPassed: null, moderationSkipped:false } : {}),
        ...(table === 'deletions' ? { state:'PENDING', requestedAt:new Date(), availableAt:new Date(), claimedUntil:null, completedAt:null, attempts:0, errorCode:null } : {}), ...(table === 'driveConnections' ? {activeUntil:null} : {}), ...(table === 'driveLinks' ? {status:'PENDING',encryptedCleanupToken:null,exchangingUntil:null} : {}), ...(table === 'chatMessages' ? {erasedAt:null,moderationSkipped:false} : {}),
        ...(table === 'chatThreads' ? { nextSequence: 0 } : {}), ...(table === 'chatReceipts' ? { reason: null, messageId: null, sequence: null } : {}), ...(table === 'chatReports' ? { status: 'OPEN', detail: null } : {}),
        ...(table === 'diagnostics' ? { attempts: 0, code: null, availableAt: new Date(), exportedAt: null } : {}),
        ...(['receipts', 'worldReceipts', 'burnReceipts'].includes(table) ? { reason: null, letterId: null } : {}),
        ...(table === 'voiceAssets' ? { destinationType: 'FRIEND', status: 'UPLOADING', purgeAfter: null, stageClearedAt: null, contentClearedAt: null } : {}), ...(table === 'reports' ? { status: 'OPEN', resolvedAt: null } : {}), ...(table === 'blocks' ? { anonymousAlias: null } : {}), ...data };
      state[table].push(row); return project(full(table, row), select)!;
    };
    const update = async ({ where, data, select }: Args) => {
      const row = state[table].find(r => matches(full(table, r), where)); if (!row) throw conflict('P2025'); assign(row, data); return project(full(table, row), select)!;
    };
    return {
      findUnique: async (args: Args) => project(find(args)[0], args.select), findFirst: async (args: Args) => project(find(args)[0], args.select),
      findMany: async (args: Args = {}) => find(args).map(r => project(r, args.select)!), count: async (args: Args = {}) => find(args).length,
      aggregate: async (args: Args = {}) => ({ _sum: Object.fromEntries(Object.keys(args._sum ?? {}).map(key=>[key,find(args).reduce((sum,row)=>sum+Number(row[key]??0),0)])) }),
      create, update, updateMany: async ({ where, data }: Args) => { const rows = state[table].filter(r => matches(full(table, r), where)); rows.forEach(r => assign(r, data)); return { count: rows.length }; },
      delete: async ({ where }: Args) => { const row = state[table].find(r => matches(full(table, r), where)); if (!row) throw conflict('P2025'); state[table] = state[table].filter(r => r !== row); if (table === 'requests') state.jobs = state.jobs.filter(j => j.requestId !== row.id); return row; },
      deleteMany: async ({ where }: Args) => { const before = state[table].length; state[table] = state[table].filter(r => !matches(full(table, r), where)); return { count: before - state[table].length }; },
      upsert: async (args: Args) => find(args).length ? update({ ...args, data: args.update }) : create({ ...args, data: args.create }),
    };
  }
  let queue = Promise.resolve();
  const models = { palaceEvent:model('events'), accountDeletion: model('deletions'), driveConnection: model('driveConnections'), driveLink: model('driveLinks'), user: model('users'), character: model('characters'), diagnosticsEvent: model('diagnostics'), friendRequest: model('requests'), friendNotification: model('jobs'), pushToken: model('tokens'), letter: model('letters'), deliveryReceipt: model('receipts'), worldReceipt: model('worldReceipts'), preset: model('presets'), burnReceipt: model('burnReceipts'), voiceAsset: model('voiceAssets'), block: model('blocks'), report: model('reports'), requestWindow: model('budgets'), chatThread: model('chatThreads'), chatMessage: model('chatMessages'), chatReceipt: model('chatReceipts'), chatReport: model('chatReports') };
  const database = { ...models, $transaction: async (operation: (tx: typeof models) => Promise<unknown>) => {
    if (state.conflicts > 0) { state.conflicts--; throw conflict('P2034'); }
    let release = () => {}; const before = queue; queue = new Promise<void>(resolve => { release = resolve; }); await before;
    const snapshot = structuredClone({ events:state.events, deletions: state.deletions, driveConnections: state.driveConnections, driveLinks: state.driveLinks, users: state.users, diagnostics: state.diagnostics, requests: state.requests, jobs: state.jobs, tokens: state.tokens, letters: state.letters, receipts: state.receipts, worldReceipts: state.worldReceipts, burnReceipts: state.burnReceipts, voiceAssets: state.voiceAssets, blocks: state.blocks, reports: state.reports, budgets: state.budgets, chatThreads: state.chatThreads, chatMessages: state.chatMessages, chatReceipts: state.chatReceipts, chatReports: state.chatReports });
    try { return await operation(models); } catch (error) { Object.assign(state, snapshot); throw error; } finally { release(); }
  } };
  return { state, database, reset, user };
}
export async function createFriendsTestApp(pushEnabled = false, moderation?: Pick<LetterModerationService, 'available' | 'check'> & Partial<Pick<LetterModerationService, 'voiceAvailable' | 'checkVoice'>>, storage?: Pick<VoiceStorageService, 'available' | 'upload' | 'read' | 'put' | 'playback' | 'remove'>, moderationMode: 'required'|'disabled' = 'required', environment: Record<string,unknown> = {}) {
  const fixture = friendsFixture();
  const builder = Test.createTestingModule({ imports: [FriendsModule, NotificationsModule, LettersModule, SafetyModule, CharactersModule, PresetsModule, DiagnosticsModule, RetentionModule, ChatModule, AccountModule] })
    .overrideProvider(ConfigService).useValue(new ConfigService(validateEnvironment({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://localhost:5432/test', MODERATION_MODE: moderationMode, EXPO_PUSH_ENABLED: String(pushEnabled), ...environment })))
    .overrideProvider(PrismaService).useValue(fixture.database)
    .overrideProvider(IdentityRemoval).useValue({ remove: async () => {} })
    .overrideProvider(ClerkTokenVerifier).useValue({ verify: async (token: string) => { if (!['alice', 'bob', 'carol', 'bert', 'new-user'].includes(token)) throw new UnauthorizedException(); return { subject: token, sessionId: `fixture-${token}` }; } });
  if (moderation) builder.overrideProvider(LetterModerationService).useValue(moderation);
  if (storage) builder.overrideProvider(VoiceStorageService).useValue(storage);
  const module = await builder.compile();
  const app = module.createNestApplication({ logger: false }); configureApp(app); await app.listen(0, '127.0.0.1');
  // Tests drive dispatch explicitly; never leave a timer that could send push.
  const notifications = app.get(NotificationsService); notifications.onModuleDestroy();
  const voiceAssets = app.get(VoiceAssetsService); voiceAssets.onModuleDestroy();
  app.get(RequestLimits).onModuleDestroy(); app.get(AccountService).onModuleDestroy(); app.get(PalaceEvents).onModuleDestroy();
  app.get(DiagnosticsService).onModuleDestroy(); app.get(RetentionService).onModuleDestroy();
  return { app, url: await app.getUrl(), fixture, notifications, voiceAssets };
}
