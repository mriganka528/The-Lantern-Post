import type { Prisma } from '@prisma/client';
export const chatVisibleTo = (ownerId: string): Prisma.ChatMessageWhereInput => ({ OR: [
  { senderId: ownerId, senderDeletedAt: null },
  { senderId: { not: ownerId }, recipientDeletedAt: null },
] });
