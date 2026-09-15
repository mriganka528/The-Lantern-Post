import { PalaceEvents } from '../realtime/palace-events';
import { Optional } from '@nestjs/common';
import { activeAccount } from '../account/account-access';
import { ConflictException, HttpException, HttpStatus, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { FriendConnection, FriendSearchResponse, FriendSummary, FriendsPage, FriendsView } from '@lantern-post/shared-types';
import { PrismaService } from '../database/prisma.service';
import { connection, connectionSelect, nextCursor, notBlocked, pageBoundary, person, personSelect, relationship, visibleConnections } from './friend-contract';
import { consumeRequestWindow } from '../safety/request-limits';

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService, @Optional() private events?: PalaceEvents) {}

  private async owner(authProviderId: string) {
    const row = await this.prisma.user.findUnique({ where: { authProviderId, accountState: 'ACTIVE' }, select: { id: true, characterId: true } });
    if (!row) throw new ConflictException({ code: 'PROFILE_REQUIRED', message: 'Choose a username first.' });
    if (!row.characterId) throw new ConflictException({ code: 'CHARACTER_REQUIRED', message: 'Choose a companion first.' });
    return row;
  }
  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt++) {
      try { return await this.prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 }); }
      catch (error) {
        if (error instanceof HttpException) throw error;
        if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034', 'P2025'].includes(error.code) && attempt < 3) continue;
        throw new ServiceUnavailableException({ code: 'FRIENDS_UNAVAILABLE', message: 'We could not confirm that invitation. Refresh and try again.' });
      }
    }
    throw new ServiceUnavailableException();
  }
  async search(authProviderId: string, username: string): Promise<FriendSearchResponse> {
    const owner = await this.owner(authProviderId);
    // Prisma's PostgreSQL prefix filter uses LIKE. An underscore in a real
    // username is literal, not the SQL single-character wildcard.
    const matches = await this.prisma.user.findMany({ where: { ...notBlocked(owner.id), id: { not: owner.id }, characterId: { not: null }, username: { startsWith: username.replaceAll('_', '\\_') } },
      select: personSelect, orderBy: { username: 'asc' }, take: 21 });
    const people = matches.slice(0, 20);
    const ids = people.map(p => p.id);
    const requests = ids.length ? await this.prisma.friendRequest.findMany({ where: { OR: [{ fromUserId: owner.id, toUserId: { in: ids } }, { toUserId: owner.id, fromUserId: { in: ids } }] }, select: connectionSelect }) : [];
    return { results: people.flatMap(row => {
      const request = requests.find(r => r.fromUserId === row.id || r.toUserId === row.id);
      if (request?.status === 'BLOCKED') return [];
      return [{ person: person(row), relationship: relationship(request, owner.id), requestId: request?.id ?? null }];
    }), hasMore: matches.length > 20 };
  }
  async list(authProviderId: string, view: FriendsView, cursor?: string, username?: string): Promise<FriendsPage> {
    const boundary = pageBoundary(cursor);
    const owner = await this.owner(authProviderId);
    // Search only the peer, not the owner. Escape literal username underscores
    // before PostgreSQL LIKE matching, and filter before applying the page cap.
    const peerName = { username: { contains: username?.replaceAll('_', '\\_') } };
    const nameFilter: Prisma.FriendRequestWhereInput = username ? { OR: [
      { fromUserId: owner.id, toUser: peerName }, { toUserId: owner.id, fromUser: peerName },
    ] } : {};
    const where = { AND: [visibleConnections(owner.id), boundary, nameFilter, view === 'friends' ? { status: 'ACCEPTED' as const } : { status: 'PENDING' as const, ...(view === 'incoming' ? { toUserId: owner.id } : { fromUserId: owner.id }) }] };
    const rows = await this.prisma.friendRequest.findMany({ where, select: connectionSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 25 });
    const page = rows.slice(0, 24);
    return { items: page.map(r => connection(r, owner.id)), nextCursor: rows.length > 24 ? nextCursor(page[page.length - 1]!) : null };
  }
  async summary(authProviderId: string): Promise<FriendSummary> {
    const owner = await this.owner(authProviderId);
    const visible = visibleConnections(owner.id);
    const [friends, incoming, outgoing] = await Promise.all([
      this.prisma.friendRequest.count({ where: { AND: [visible, { status: 'ACCEPTED' }] } }),
      this.prisma.friendRequest.count({ where: { AND: [visible, { status: 'PENDING', toUserId: owner.id }] } }),
      this.prisma.friendRequest.count({ where: { AND: [visible, { status: 'PENDING', fromUserId: owner.id }] } }),
    ]);
    return { friends, incoming, outgoing };
  }
  async send(authProviderId: string, username: string): Promise<FriendConnection> {
    const owner = await this.owner(authProviderId);
    const result = await this.transaction(async tx => {
      await activeAccount(tx, owner.id);
      const target = await tx.user.findFirst({ where: { username, ...notBlocked(owner.id), characterId: { not: null } }, select: { id: true } });
      if (!target || target.id === owner.id) throw new NotFoundException({ code: 'FRIEND_UNAVAILABLE', message: 'This palace is unavailable for invitations.' });
      const existing = await tx.friendRequest.findFirst({ where: { OR: [{ fromUserId: owner.id, toUserId: target.id }, { fromUserId: target.id, toUserId: owner.id }] }, select: connectionSelect });
      if (existing) {
        const state = relationship(existing, owner.id);
        if (state === 'UNAVAILABLE') throw new ConflictException({ code: 'INVITATION_UNAVAILABLE', message: 'An invitation cannot be sent to this palace right now.' });
        // Crossed requests converge on the existing invitation. Only its
        // recipient's explicit accept action can establish a friendship.
        if (state !== 'NONE') return connection(existing, owner.id);
      }
      const recent = await tx.friendRequest.count({ where: { fromUserId: owner.id, createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
      if (recent >= 20) throw new HttpException({ code: 'INVITATION_LIMIT', message: 'Please wait before sending more invitations.' }, HttpStatus.TOO_MANY_REQUESTS);
      // Blocks/unblocks and renewed invitations must not reset the daily
      // budget by deleting the old friendship row. Commit it with the outbox.
      try { await consumeRequestWindow(tx, owner.id, { scope: 'friend-invitation-day', maximum: 20, milliseconds: 86_400_000 }, Date.now(), recent); }
      catch (error) { if (error instanceof HttpException && error.getStatus() === 429) throw new HttpException({ code: 'INVITATION_LIMIT', message: 'Please wait before sending more invitations.' }, HttpStatus.TOO_MANY_REQUESTS); throw error; }
      // A new ID after the cooldown prevents a late response from an old tab
      // accepting a different invitation. Old declined outbox rows cascade.
      if (existing) await tx.friendRequest.delete({ where: { id: existing.id } });
      const row = await tx.friendRequest.create({ data: { fromUserId: owner.id, toUserId: target.id }, select: connectionSelect });
      await this.events?.append(tx,[{ownerId:owner.id,kind:'FRIENDS_CHANGED',peerId:target.id,itemId:row.id},{id:row.id+':received',ownerId:target.id,kind:'FRIEND_REQUEST',peerId:owner.id,itemId:row.id}]);
      await tx.friendNotification.create({ data: { id: `${row.id}:received`, userId: target.id, requestId: row.id, kind: 'FRIEND_REQUEST' } });
      return connection(row, owner.id);
    }); this.events?.notify([owner.id,result.person.id]);return result;
  }
  async respond(authProviderId: string, id: string, action: 'accept' | 'decline'): Promise<FriendConnection> {
    const owner = await this.owner(authProviderId);
    const result = await this.transaction(async tx => {
      await activeAccount(tx, owner.id);
      const row = await tx.friendRequest.findFirst({ where: { AND: [visibleConnections(owner.id), { id, toUserId: owner.id }] }, select: connectionSelect });
      if (!row) throw new NotFoundException({ code: 'INVITATION_MISSING', message: 'This invitation is no longer available.' });
      const status = action === 'accept' ? 'ACCEPTED' : 'DECLINED';
      if (row.status === status) return connection(row, owner.id);
      if (row.status !== 'PENDING') throw new ConflictException({ code: 'INVITATION_RESOLVED', message: 'This invitation was already answered. Refresh to see it.' });
      const updated = await tx.friendRequest.update({ where: { id: row.id }, data: { status, respondedAt: new Date() }, select: connectionSelect });
      await this.events?.append(tx,[{ownerId:owner.id,kind:'FRIENDS_CHANGED',peerId:row.fromUserId,itemId:row.id},{...(status==='ACCEPTED'?{id:row.id+':accepted'}:{}),ownerId:row.fromUserId,kind:status==='ACCEPTED'?'FRIEND_ACCEPTED':'FRIENDS_CHANGED',peerId:owner.id,itemId:row.id}]);
      if (status === 'ACCEPTED') await tx.friendNotification.create({ data: { id: `${row.id}:accepted`, userId: row.fromUserId, requestId: row.id, kind: 'FRIEND_ACCEPTED' } });
      return connection(updated, owner.id);
    }); this.events?.notify([owner.id,result.person.id]);return result;
  }
  async remove(authProviderId: string, id: string) {
    const owner = await this.owner(authProviderId);
    const peer = await this.transaction(async tx => {
      await activeAccount(tx, owner.id);
      // Bind confirmation/retry to this friendship ID, never a replacement
      // invitation that may have been created later for the same two people.
      const row = await tx.friendRequest.findFirst({ where: { AND: [visibleConnections(owner.id), { id }] }, select: connectionSelect });
      if (!row) throw new NotFoundException({ code: 'FRIENDSHIP_MISSING', message: 'This friendship is no longer available. Refresh the guestbook.' });
      if (row.status !== 'ACCEPTED' && row.status !== 'DECLINED') throw new ConflictException({ code: 'FRIENDSHIP_CHANGED', message: 'Only an accepted friendship can be removed.' });
      const peerId = row.fromUserId === owner.id ? row.toUserId : row.fromUserId;
      if (row.status === 'DECLINED') return peerId;
      await tx.friendRequest.update({ where: { id: row.id }, data: { status: 'DECLINED', respondedAt: new Date() } });
      // Keep receipts, letters and existing block records. Uncommitted voice
      // uploads are queued for cleanup because this delivery gate is closed.
      await tx.voiceAsset.updateMany({ where: { status: { in: ['UPLOADING','READY'] }, OR: [{ ownerId: owner.id, recipientId: peerId }, { ownerId: peerId, recipientId: owner.id }] }, data: { status: 'DELETED', sha256: null, purgeAfter: new Date() } });
      await this.events?.append(tx, [{ ownerId: owner.id, kind: 'GATES_CHANGED', peerId }, { ownerId: peerId, kind: 'GATES_CHANGED', peerId: owner.id }]);
      return peerId;
    });
    this.events?.notify([owner.id, peer]);
    return { removed: true as const };
  }
}
