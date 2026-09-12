import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/database/prisma.service';
import { serializeSelfProfile } from '../src/users/profile';
import { UsersModule } from '../src/users/users.module';
import { UsersService } from '../src/users/users.service';

const createdAt = new Date('2026-09-11T00:00:00.000Z');
const storedProfile = {
  id: 'user-one', username: 'lantern_fox', characterId: null, palaceTheme: null, createdAt,
};

function uniqueConflict(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '6.19.3' });
}

type StoredProfile = typeof storedProfile;
type StubUserModel = {
  findUnique: (args: { where: { authProviderId?: string; username?: string } }) => Promise<StoredProfile | null>;
  create: (args: { data: { authProviderId: string; username: string } }) => Promise<StoredProfile>;
};

async function withUsers(user: StubUserModel, run: (service: UsersService) => Promise<void>): Promise<void> {
  const module = await Test.createTestingModule({ imports: [UsersModule] })
    .overrideProvider(PrismaService)
    .useValue({ user })
    .compile();
  try { await run(module.get(UsersService)); } finally { await module.close(); }
}

test('self-profile serialization omits managed identity and unexpected private fields', () => {
  const row = { ...storedProfile, authProviderId: 'private-provider-id', email: 'private@example.invalid' };
  assert.deepEqual(serializeSelfProfile(row), { ...storedProfile, createdAt: createdAt.toISOString() });
});

test('first onboarding links the verified identity and returns only the owner profile', async () => {
  await withUsers({
    findUnique: async () => null,
    create: async ({ data }) => {
      assert.deepEqual(data, { authProviderId: 'verified-subject', username: storedProfile.username });
      return storedProfile;
    },
  }, async (service) => {
    assert.equal(await service.findSelf('verified-subject'), null);
    assert.deepEqual(await service.createProfile('verified-subject', storedProfile.username), {
      ...storedProfile, createdAt: createdAt.toISOString(),
    });
  });
});

test('a returning account can repeat onboarding without creating another user', async () => {
  await withUsers({
    findUnique: async ({ where }) => {
      assert.deepEqual(where, { authProviderId: 'verified-subject' });
      return storedProfile;
    },
    create: async () => { throw new Error('A second user must not be created'); },
  }, async (service) => {
    const result = await service.createProfile('verified-subject', storedProfile.username);
    assert.equal(result.id, storedProfile.id);
  });
});

test('onboarding cannot be replayed to rename an existing account', async () => {
  await withUsers({
    findUnique: async () => storedProfile,
    create: async () => { throw new Error('Existing account must not be changed'); },
  }, async (service) => {
    await assert.rejects(service.createProfile('verified-subject', 'another_name'), (error: unknown) =>
      error instanceof ConflictException && error.getStatus() === 409 &&
      (error.getResponse() as { code: string }).code === 'PROFILE_EXISTS');
  });
});

test('a username claimed between availability and creation returns a conflict', async () => {
  await withUsers({
    findUnique: async () => null,
    create: async ({ data }) => {
      assert.deepEqual(data, { authProviderId: 'verified-subject', username: storedProfile.username });
      throw uniqueConflict();
    },
  }, async (service) => {
    assert.equal(await service.isUsernameAvailable(storedProfile.username), true);
    await assert.rejects(service.createProfile('verified-subject', storedProfile.username), (error: unknown) =>
      error instanceof ConflictException && error.getStatus() === 409 &&
      (error.getResponse() as { code: string }).code === 'USERNAME_TAKEN');
  });
});

test('simultaneous creation for the same identity returns the winning profile', async () => {
  let identityReads = 0;
  await withUsers({
    findUnique: async () => ++identityReads === 1 ? null : storedProfile,
    create: async () => { throw uniqueConflict(); },
  }, async (service) => {
    assert.equal((await service.createProfile('verified-subject', storedProfile.username)).id, storedProfile.id);
  });
});

test('a database outage is not misreported as an available or taken username', async () => {
  const outage = new Error('Database unavailable');
  await withUsers({
    findUnique: async () => null,
    create: async () => { throw outage; },
  }, async (service) => {
    await assert.rejects(service.createProfile('verified-subject', storedProfile.username), (error: unknown) => error === outage);
  });
});
