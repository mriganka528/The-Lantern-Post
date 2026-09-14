CREATE TYPE "VoiceAssetStatus" AS ENUM ('UPLOADING', 'READY', 'ATTACHED', 'DELETED');
CREATE TABLE "VoiceAsset" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteLength" INTEGER NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "sha256" TEXT,
  "status" "VoiceAssetStatus" NOT NULL DEFAULT 'UPLOADING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "purgeAfter" TIMESTAMP(3),
  "stageClearedAt" TIMESTAMP(3),
  "contentClearedAt" TIMESTAMP(3),
  CONSTRAINT "VoiceAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VoiceAsset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "VoiceAsset_limits" CHECK ("mimeType" IN ('audio/webm','audio/mp4') AND "byteLength" BETWEEN 64 AND 8388608 AND "durationMs" BETWEEN 1000 AND 180000),
  CONSTRAINT "VoiceAsset_checksum" CHECK ("status" = 'DELETED' OR "sha256" IS NOT NULL)
);
CREATE UNIQUE INDEX "VoiceAsset_storageKey_key" ON "VoiceAsset"("storageKey");
CREATE UNIQUE INDEX "VoiceAsset_ownerId_requestId_key" ON "VoiceAsset"("ownerId", "requestId");
CREATE INDEX "VoiceAsset_status_purgeAfter_idx" ON "VoiceAsset"("status", "purgeAfter");
CREATE INDEX "VoiceAsset_ownerId_status_expiresAt_idx" ON "VoiceAsset"("ownerId", "status", "expiresAt");
ALTER TABLE "Letter" ADD COLUMN "voiceAssetId" TEXT;
CREATE UNIQUE INDEX "Letter_voiceAssetId_key" ON "Letter"("voiceAssetId");
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_voiceAssetId_fkey" FOREIGN KEY ("voiceAssetId") REFERENCES "VoiceAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Letter" DROP CONSTRAINT "Letter_private_delivery_check";
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_private_delivery_check" CHECK (
  "destinationType" <> 'FRIEND' OR "status" <> 'DELIVERED' OR
  ("recipientId" IS NOT NULL AND "recipientId" <> "senderId" AND "moderationPassed" IS TRUE AND "moderationCheckedAt" IS NOT NULL AND "stationeryJson" IS NOT NULL AND "deliveredAt" IS NOT NULL AND
   (("type" = 'TEXT' AND "textContent" IS NOT NULL AND "audioUrl" IS NULL AND "voiceAssetId" IS NULL) OR
    ("type" = 'VOICE' AND "textContent" IS NULL AND "voiceAssetId" IS NOT NULL AND "audioDurationMs" IS NOT NULL AND "audioDurationMs" BETWEEN 1000 AND 180000 AND "audioUrl" IS NULL)))
);
ALTER TABLE "DeliveryReceipt" DROP CONSTRAINT "DeliveryReceipt_outcome_check";
ALTER TABLE "DeliveryReceipt" ADD CONSTRAINT "DeliveryReceipt_outcome_check" CHECK (
  ("outcome" = 'DELIVERED' AND "reason" IS NULL AND "letterId" IS NOT NULL) OR
  ("outcome" = 'REJECTED' AND "letterId" IS NULL AND "reason" IS NOT NULL AND "reason" IN ('FRIEND_UNAVAILABLE','PRESET_UNAVAILABLE','CONTENT_NOT_ALLOWED','DELIVERY_LIMIT','VOICE_UNAVAILABLE','CANCELLED'))
);
