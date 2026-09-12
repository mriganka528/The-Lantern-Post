-- Preserve existing rows. If manually-created reverse duplicates exist, this
-- constraint fails rather than silently choosing or deleting a friendship.
ALTER TABLE "FriendRequest" ADD CONSTRAINT "FriendRequest_no_self" CHECK ("fromUserId" <> "toUserId");
CREATE UNIQUE INDEX "FriendRequest_unordered_pair_key" ON "FriendRequest" (LEAST("fromUserId", "toUserId"), GREATEST("fromUserId", "toUserId"));
CREATE INDEX "FriendRequest_toUserId_status_createdAt_idx" ON "FriendRequest" ("toUserId", "status", "createdAt");
CREATE INDEX "FriendRequest_fromUserId_status_createdAt_idx" ON "FriendRequest" ("fromUserId", "status", "createdAt");
CREATE INDEX "PushToken_userId_idx" ON "PushToken" ("userId");

CREATE TABLE "FriendNotification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedUntil" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "FriendNotification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FriendNotification_kind_check" CHECK ("kind" IN ('FRIEND_REQUEST', 'FRIEND_ACCEPTED')),
  CONSTRAINT "FriendNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FriendNotification_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "FriendRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "FriendNotification_completedAt_availableAt_idx" ON "FriendNotification" ("completedAt", "availableAt");
