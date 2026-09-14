ALTER TABLE "Letter" ADD COLUMN "senderDeletedAt" TIMESTAMP(3);
ALTER TABLE "Letter" ADD COLUMN "recipientDeletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "realtimeSequence" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD CONSTRAINT "User_realtimeSequence_check" CHECK ("realtimeSequence" >= 0);
CREATE TABLE "PalaceEvent" (
  "id" TEXT PRIMARY KEY,
  "ownerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "sequence" INTEGER NOT NULL CHECK ("sequence">0),
  "kind" TEXT NOT NULL CHECK ("kind" IN ('FRIENDS_CHANGED','FRIEND_REQUEST','FRIEND_ACCEPTED','LETTERBOX_CHANGED','LETTER_REMOVED','LETTER_RECEIVED','CHAT_CHANGED','CHAT_RECEIVED','GATES_CHANGED')),
  "peerId" TEXT,
  "itemId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PalaceEvent_ownerId_sequence_key" ON "PalaceEvent"("ownerId","sequence");
CREATE INDEX "PalaceEvent_createdAt_idx" ON "PalaceEvent"("createdAt");
ALTER TABLE "FriendNotification" ADD COLUMN "chatMessageId" TEXT;
ALTER TABLE "FriendNotification" DROP CONSTRAINT IF EXISTS "FriendNotification_kind_check";
ALTER TABLE "FriendNotification" ADD CONSTRAINT "FriendNotification_kind_check" CHECK (
 ("kind" IN ('FRIEND_REQUEST','FRIEND_ACCEPTED') AND "requestId" IS NOT NULL AND "letterId" IS NULL AND "chatMessageId" IS NULL) OR
 ("kind"='LETTER_DELIVERED' AND "letterId" IS NOT NULL AND "requestId" IS NULL AND "chatMessageId" IS NULL) OR
 ("kind"='CHAT_MESSAGE' AND "chatMessageId" IS NOT NULL AND "requestId" IS NULL AND "letterId" IS NULL)
);
