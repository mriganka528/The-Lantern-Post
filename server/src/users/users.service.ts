import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SelfProfile } from '@lantern-post/shared-types';
import { PrismaService } from '../database/prisma.service';
import { selfProfileSelect, serializeSelfProfile } from './profile';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // authProviderId must come from a verified managed-auth identity, never a DTO.
  async findSelf(authProviderId: string): Promise<SelfProfile | null> {
    const profile = await this.prisma.user.findUnique({
      where: { authProviderId },
      select: selfProfileSelect,
    });
    return profile ? serializeSelfProfile(profile) : null;
  }

  async isUsernameAvailable(canonicalUsername: string): Promise<boolean> {
    const profile = await this.prisma.user.findUnique({
      where: { username: canonicalUsername },
      select: { id: true },
    });
    return profile === null;
  }

  // The controller must validate the approved username and age rules first.
  // Existing profiles are never renamed by replaying account onboarding.
  async createProfile(authProviderId: string, canonicalUsername: string): Promise<SelfProfile> {
    const existing = await this.findSelf(authProviderId);
    if (existing) return this.existingProfile(existing, canonicalUsername);

    try {
      const profile = await this.prisma.user.create({
        data: { authProviderId, username: canonicalUsername },
        select: selfProfileSelect,
      });
      return serializeSelfProfile(profile);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }

      // A uniqueness constraint decides concurrent claims, not an availability
      // precheck. Retrying the same account/username after a lost response is safe.
      const concurrentProfile = await this.findSelf(authProviderId);
      if (concurrentProfile) return this.existingProfile(concurrentProfile, canonicalUsername);
      throw new ConflictException({ code: 'USERNAME_TAKEN', message: 'That username is already taken.' });
    }
  }

  private existingProfile(profile: SelfProfile, canonicalUsername: string): SelfProfile {
    if (profile.username !== canonicalUsername) {
      throw new ConflictException({ code: 'PROFILE_EXISTS', message: 'This account already has a username.' });
    }
    return profile;
  }
}
