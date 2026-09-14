import { GoneException, Injectable, Module, SetMetadata } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma.service';
export const DELETION_ACCESS = 'lantern-deletion-access';
export const AllowDeletionAccess = () => SetMetadata(DELETION_ACCESS, true);
export const deletionSubjectHash = (subject: string) => createHash('sha256').update('account-deletion\0' + subject).digest('hex');
export function accountGone(): never { throw new GoneException({ code: 'ACCOUNT_CLOSED', message: 'This account is closed. Its removal is being completed.' }); }
export async function activeAccount(tx: Prisma.TransactionClient, ownerId: string) {
  const user = await tx.user.findFirst({ where: { id: ownerId, accountState: 'ACTIVE' }, select: { id: true } });
  if (!user) accountGone();
}
@Injectable()
export class AccountAccess {
  constructor(private prisma: PrismaService) {}
  async assertSubject(subject: string) {
    const closed = await this.prisma.accountDeletion.findUnique({ where: { subjectHash: deletionSubjectHash(subject) }, select: { id: true } });
    if (closed) accountGone();
    const user = await this.prisma.user.findUnique({ where: { authProviderId: subject }, select: { accountState: true } });
    if (user && user.accountState !== 'ACTIVE') accountGone();
  }
}
@Module({ imports: [DatabaseModule], providers: [AccountAccess], exports: [AccountAccess] })
export class AccountAccessModule {}
