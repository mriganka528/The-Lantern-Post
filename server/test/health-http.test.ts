import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { configureApp } from '../src/configure-app';
import { validateEnvironment } from '../src/config/environment';
import { PrismaService } from '../src/database/prisma.service';
import { HealthModule } from '../src/health/health.module';

test('GET and HEAD health checks stay public and uncached without accessing the database', async () => {
  let queries = 0;
  const environment = validateEnvironment({
    NODE_ENV: 'production', DATABASE_URL: 'postgresql://localhost:5432/health_test',
    CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from('test.clerk.accounts.dev$').toString('base64')}`,
    CLERK_SECRET_KEY: 'sk_test_fixture',
  });
  const module = await Test.createTestingModule({ imports: [HealthModule] })
    .overrideProvider(ConfigService).useValue(new ConfigService(environment))
    .overrideProvider(PrismaService).useValue({ $queryRaw: async () => { queries++; throw Error('synthetic private database error'); } })
    .compile();
  const app = module.createNestApplication({ logger: false });
  configureApp(app); await app.listen(0, '127.0.0.1');
  try {
    const origin = await app.getUrl();
    const live = await fetch(origin + '/health');
    assert.equal(live.status, 200); assert.equal(live.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await live.json(), { status: 'ok', service: 'lantern-post-api' });
    const head = await fetch(origin + '/health', { method: 'HEAD' });
    assert.equal(head.status, 200); assert.equal(head.headers.get('Cache-Control'), 'no-store'); assert.equal(await head.text(), '');
    assert.equal(queries, 0);
    const ready = await fetch(origin + '/health/ready');
    assert.equal(ready.status, 503); assert.equal(queries, 1);
    assert.deepEqual(await ready.json(), { status: 'error', service: 'lantern-post-api', checks: { database: 'down' } });
  } finally { await app.close(); }
});
