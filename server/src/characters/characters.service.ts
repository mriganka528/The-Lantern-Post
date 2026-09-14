import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CharacterDetails, PalaceResponse, SelfProfile } from '@lantern-post/shared-types';
import { PrismaService } from '../database/prisma.service';
import { selfProfileSelect, serializeSelfProfile } from '../users/profile';
import { characterKeys, serializeCharacter } from './catalog';

const characterSelect = { id: true, key: true, displayName: true, assetUrl: true } as const;

@Injectable()
export class CharactersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<CharacterDetails[]> {
    const rows = await this.prisma.character.findMany({
      where: { isActive: true, key: { in: characterKeys } }, select: characterSelect,
    });
    return rows.flatMap((row) => {
      const character = serializeCharacter(row);
      return character ? [character] : [];
    }).sort((a, b) => characterKeys.indexOf(a.key) - characterKeys.indexOf(b.key));
  }

  async palace(authProviderId: string): Promise<PalaceResponse> {
    const user = await this.prisma.user.findUnique({
      where: { authProviderId, accountState: 'ACTIVE' }, select: { character: { select: characterSelect } },
    });
    if (!user) throw new ConflictException({ code: 'PROFILE_REQUIRED', message: 'Choose a username first.' });
    // Retired companions remain available to their existing owners.
    const character = user.character ? serializeCharacter(user.character) : null;
    if (user.character && !character) throw new NotFoundException({ code: 'PALACE_UNAVAILABLE', message: 'This palace is unavailable.' });
    return { character };
  }

  async choose(authProviderId: string, characterId: string): Promise<SelfProfile> {
    return this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({ where: { authProviderId, accountState: 'ACTIVE' }, select: { id: true } });
      if (!user) throw new ConflictException({ code: 'PROFILE_REQUIRED', message: 'Choose a username first.' });
      const row = await transaction.character.findUnique({ where: { id: characterId }, select: { ...characterSelect, isActive: true } });
      const character = row?.isActive ? serializeCharacter(row) : null;
      if (!character) throw new NotFoundException({ code: 'CHARACTER_UNAVAILABLE', message: 'Choose an available companion.' });
      // A single update saves the pair. A retry has the same result; no side effects.
      const profile = await transaction.user.update({
        where: { authProviderId, accountState: 'ACTIVE' },
        data: { characterId: character.id, palaceTheme: character.palace.theme },
        select: selfProfileSelect,
      });
      return serializeSelfProfile(profile);
    });
  }
}
