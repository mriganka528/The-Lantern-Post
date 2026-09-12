import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../src/database/prisma.service';
import { HealthModule } from '../src/health/health.module';

let app: INestApplication;
let baseUrl: string;
let databaseAvailable = true;

before(async () => {
  const module = await Test.createTestingModule({ imports: [HealthModule] })
    .overrideProvider(PrismaService)
    .useValue({
      $queryRaw: async () => {
        if (!databaseAvailable) throw new Error('postgresql://private:secret@database.internal/lantern-post');
        return [{ '?column?': 1 }];
      },
    })
    .compile();
  app = module.createNestApplication({ logger: false });
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
});

after(async () => { await app?.close(); });

test('liveness responds over HTTP', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', service: 'lantern-post-api' });
});

test('readiness reports an available database', async () => {
  const response = await fetch(`${baseUrl}/health/ready`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', service: 'lantern-post-api', checks: { database: 'up' } });
});

test('database failure returns 503 without leaking connection details, while liveness stays up', async () => {
  databaseAvailable = false;
  try {
    const response = await fetch(`${baseUrl}/health/ready`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: 'error', service: 'lantern-post-api', checks: { database: 'down' } });
    assert.equal((await fetch(`${baseUrl}/health`)).status, 200);
  } finally {
    databaseAvailable = true;
  }
});
