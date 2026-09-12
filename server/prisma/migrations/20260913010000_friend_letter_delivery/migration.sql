CREATE TYPE "DeliveryOutcome" AS ENUM ('DELIVERED', 'REJECTED');
CREATE TABLE "DeliveryReceipt" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "outcome" "DeliveryOutcome" NOT NULL,
  "reason" TEXT,
  "letterId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeliveryReceipt_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DeliveryReceipt_outcome_check" CHECK (
    ("outcome" = 'DELIVERED' AND "reason" IS NULL AND "letterId" IS NOT NULL) OR
    ("outcome" = 'REJECTED' AND "letterId" IS NULL AND "reason" IS NOT NULL AND "reason" IN ('FRIEND_UNAVAILABLE', 'PRESET_UNAVAILABLE', 'CONTENT_NOT_ALLOWED', 'DELIVERY_LIMIT', 'CANCELLED'))
  )
);
CREATE UNIQUE INDEX "DeliveryReceipt_letterId_key" ON "DeliveryReceipt"("letterId");
CREATE INDEX "DeliveryReceipt_ownerId_idx" ON "DeliveryReceipt"("ownerId");

ALTER TABLE "Letter" ADD COLUMN "stationeryJson" JSONB, ADD COLUMN "readAt" TIMESTAMP(3);
CREATE INDEX "Letter_senderId_destinationType_status_deliveredAt_idx" ON "Letter"("senderId", "destinationType", "status", "deliveredAt");
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_private_delivery_check" CHECK (
  "destinationType" <> 'FRIEND' OR "status" <> 'DELIVERED' OR
  ("type" = 'TEXT' AND "recipientId" IS NOT NULL AND "recipientId" <> "senderId" AND
   "textContent" IS NOT NULL AND "audioUrl" IS NULL AND "moderationPassed" IS TRUE AND
   "moderationCheckedAt" IS NOT NULL AND "stationeryJson" IS NOT NULL AND "deliveredAt" IS NOT NULL)
);

ALTER TABLE "FriendNotification" ALTER COLUMN "requestId" DROP NOT NULL;
ALTER TABLE "FriendNotification" ADD COLUMN "letterId" TEXT;
ALTER TABLE "FriendNotification" ADD CONSTRAINT "FriendNotification_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "Letter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FriendNotification" DROP CONSTRAINT "FriendNotification_kind_check";
ALTER TABLE "FriendNotification" ADD CONSTRAINT "FriendNotification_kind_check" CHECK (
  ("kind" IN ('FRIEND_REQUEST', 'FRIEND_ACCEPTED') AND "requestId" IS NOT NULL AND "letterId" IS NULL) OR
  ("kind" = 'LETTER_DELIVERED' AND "letterId" IS NOT NULL AND "requestId" IS NULL)
);
