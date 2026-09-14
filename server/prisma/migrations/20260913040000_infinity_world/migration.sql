CREATE TABLE "WorldReceipt" (
  "id" TEXT NOT NULL, "ownerId" TEXT NOT NULL, "outcome" "DeliveryOutcome" NOT NULL,
  "isSigned" BOOLEAN NOT NULL, "reason" TEXT, "letterId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorldReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorldReceipt_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorldReceipt_outcome_check" CHECK (
    ("outcome" = 'DELIVERED' AND "reason" IS NULL AND "letterId" IS NOT NULL) OR
    ("outcome" = 'REJECTED' AND "letterId" IS NULL AND "reason" IS NOT NULL AND "reason" IN ('PRESET_UNAVAILABLE','CONTENT_NOT_ALLOWED','DELIVERY_LIMIT','VOICE_UNAVAILABLE','CANCELLED'))
  )
);
CREATE UNIQUE INDEX "WorldReceipt_letterId_key" ON "WorldReceipt"("letterId");
CREATE INDEX "WorldReceipt_ownerId_createdAt_idx" ON "WorldReceipt"("ownerId", "createdAt");
ALTER TABLE "VoiceAsset" ALTER COLUMN "recipientId" DROP NOT NULL;
ALTER TABLE "VoiceAsset" ADD COLUMN "destinationType" "LetterDestinationType" NOT NULL DEFAULT 'FRIEND';
ALTER TABLE "VoiceAsset" ADD CONSTRAINT "VoiceAsset_destination_check" CHECK (
  ("destinationType" = 'FRIEND' AND "recipientId" IS NOT NULL) OR ("destinationType" = 'INFINITY' AND "recipientId" IS NULL)
);
ALTER TABLE "Block" ADD COLUMN "anonymousAlias" TEXT;
CREATE UNIQUE INDEX "Block_anonymousAlias_key" ON "Block"("anonymousAlias");
CREATE INDEX "Letter_infinity_viewport_idx" ON "Letter"("destinationType", "status", "moderationPassed", "posX", "posY");
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_public_delivery_check" CHECK (
  "destinationType" <> 'INFINITY' OR "status" <> 'DELIVERED' OR
  ("recipientId" IS NULL AND "id" ~ '^star_[a-f0-9-]{36}$' AND "moderationPassed" IS TRUE AND "moderationCheckedAt" IS NOT NULL AND "stationeryJson" IS NOT NULL AND "deliveredAt" IS NOT NULL AND
   "posX" IS NOT NULL AND "posY" IS NOT NULL AND "posX" BETWEEN 0 AND 1600 AND "posY" BETWEEN 0 AND 1000 AND "audioUrl" IS NULL AND
   (("type" = 'TEXT' AND "textContent" IS NOT NULL AND "voiceAssetId" IS NULL AND "audioDurationMs" IS NULL) OR
    ("type" = 'VOICE' AND "textContent" IS NULL AND "voiceAssetId" IS NOT NULL AND "audioDurationMs" IS NOT NULL AND "audioDurationMs" BETWEEN 1000 AND 180000)))
);
