import assert from 'node:assert/strict';
import { test } from 'node:test';
import { databaseConfiguration } from '../src/config/database';

const neon = 'postgresql://app:example%40password@ep-unit-pooler.ap-south-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

test('Neon runtime keeps pooling and migrations use the matching direct endpoint', () => {
  const database = databaseConfiguration({ DATABASE_URL: neon });
  const runtime = new URL(database.url);
  const migration = new URL(database.migrationUrl);
  assert.equal(runtime.hostname, 'ep-unit-pooler.ap-south-1.aws.neon.tech');
  assert.equal(migration.hostname, 'ep-unit.ap-south-1.aws.neon.tech');
  assert.equal(runtime.pathname, migration.pathname);
  assert.equal(runtime.username, migration.username);
  assert.equal(runtime.password, migration.password);
  assert.equal(runtime.searchParams.get('sslmode'), 'require');
  assert.equal(migration.searchParams.get('channel_binding'), 'require');
  assert.equal(runtime.searchParams.get('connect_timeout'), '15');
  assert.equal(runtime.searchParams.get('connection_limit'), '5');
});

test('explicit Neon timeouts, pool size, and stronger TLS settings are preserved', () => {
  const url = new URL(neon);
  url.searchParams.set('connect_timeout', '30');
  url.searchParams.set('connection_limit', '3');
  url.searchParams.set('sslmode', 'verify-full');
  const runtime = new URL(databaseConfiguration({ DATABASE_URL: url.toString() }).url);
  assert.equal(runtime.searchParams.get('connect_timeout'), '30');
  assert.equal(runtime.searchParams.get('connection_limit'), '3');
  assert.equal(runtime.searchParams.get('sslmode'), 'verify-full');
});

test('Neon adds required TLS if omitted and rejects an explicit insecure mode', () => {
  const url = new URL(neon);
  url.searchParams.delete('sslmode');
  assert.equal(new URL(databaseConfiguration({ DATABASE_URL: url.toString() }).url).searchParams.get('sslmode'), 'require');
  for (const mode of ['disable', 'prefer', 'allow']) {
    url.searchParams.set('sslmode', mode);
    assert.throws(() => databaseConfiguration({ DATABASE_URL: url.toString() }), /must require TLS/);
  }
});

test('a separate migration role is allowed only for the same unpooled Neon database/schema', () => {
  const direct = new URL(neon);
  direct.hostname = direct.hostname.replace('-pooler.', '.');
  direct.username = 'migration_role';
  assert.equal(new URL(databaseConfiguration({ DATABASE_URL: neon, DIRECT_URL: direct.toString() }).migrationUrl).username, 'migration_role');
  for (const change of [
    (url: URL) => { url.hostname = 'ep-other.ap-south-1.aws.neon.tech'; },
    (url: URL) => { url.pathname = '/different_database'; },
    (url: URL) => { url.searchParams.set('schema', 'different_schema'); },
  ]) {
    const wrong = new URL(direct);
    change(wrong);
    assert.throws(() => databaseConfiguration({ DATABASE_URL: neon, DIRECT_URL: wrong.toString() }), /same Neon endpoint, database, and schema/);
  }
  assert.throws(() => databaseConfiguration({ DATABASE_URL: neon, DIRECT_URL: neon }), /unpooled/);
});

test('the application database cannot be used as its own shadow, even through pooling or another schema', () => {
  const direct = new URL(neon);
  direct.hostname = direct.hostname.replace('-pooler.', '.');
  for (const shadow of [neon, direct.toString(), `${direct.toString()}&schema=shadow`]) {
    assert.throws(() => databaseConfiguration({ DATABASE_URL: neon, SHADOW_DATABASE_URL: shadow }), /separate database or Neon branch/);
  }
  direct.pathname = '/separate_shadow';
  assert.ok(databaseConfiguration({ DATABASE_URL: neon, SHADOW_DATABASE_URL: direct.toString() }).shadowDatabaseUrl);
});

test('CI or optional local PostgreSQL does not acquire Neon connection settings', () => {
  const local = 'postgresql://test:test@localhost:5432/lantern-post_ci?schema=public';
  const database = databaseConfiguration({ DATABASE_URL: local });
  assert.equal(database.url, local);
  assert.equal(database.migrationUrl, local);
  assert.equal(database.shadowDatabaseUrl, undefined);
});

test('missing or malformed configuration errors do not expose credentials', () => {
  assert.throws(() => databaseConfiguration({}), /server\/.env/);
  for (const value of ['private-connection-secret', 'https://user:private-password@example.invalid/db', `${neon}#private-secret`]) {
    assert.throws(() => databaseConfiguration({ DATABASE_URL: value }), (error: unknown) => error instanceof Error && !error.message.includes(value) && !error.message.includes('private-password'));
  }
});
