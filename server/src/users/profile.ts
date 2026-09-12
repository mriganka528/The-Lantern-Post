import type { Prisma } from '@prisma/client';
import type { SelfProfile } from '@lantern-post/shared-types';

export const selfProfileSelect = {
  id: true,
  username: true,
  characterId: true,
  palaceTheme: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

type SelectedProfile = Prisma.UserGetPayload<{ select: typeof selfProfileSelect }>;

export function serializeSelfProfile(profile: SelectedProfile): SelfProfile {
  // Explicit fields prevent auth-provider IDs or future private columns from
  // reaching the client if a query ever selects additional data.
  return {
    id: profile.id,
    username: profile.username,
    characterId: profile.characterId,
    palaceTheme: profile.palaceTheme,
    createdAt: profile.createdAt.toISOString(),
  };
}
