-- Existing approvals remain approvals. New unreviewed deliveries carry an
-- explicit marker instead of a fabricated moderation result or timestamp.
ALTER TABLE "Letter" ADD COLUMN "moderationSkipped" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChatMessage" ADD COLUMN "moderationSkipped" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChatMessage" ALTER COLUMN "moderationPassed" DROP NOT NULL;

ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_content_check";
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_content_check" CHECK (
  ("erasedAt" IS NOT NULL AND "text" = '') OR
  ("erasedAt" IS NULL AND char_length(btrim("text")) BETWEEN 1 AND 2000 AND
    (("moderationPassed" IS TRUE AND NOT "moderationSkipped") OR
     ("moderationPassed" IS NULL AND "moderationSkipped")))
);

ALTER TABLE "Letter" DROP CONSTRAINT "Letter_private_delivery_check";
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_private_delivery_check" CHECK (
  "destinationType" <> 'FRIEND' OR "status" <> 'DELIVERED' OR
  ("recipientId" IS NOT NULL AND "recipientId" <> "senderId" AND
   (("moderationPassed" IS TRUE AND NOT "moderationSkipped" AND "moderationCheckedAt" IS NOT NULL) OR
    ("moderationSkipped" AND "moderationPassed" IS NULL AND "moderationCheckedAt" IS NULL)) AND
   "stationeryJson" IS NOT NULL AND "deliveredAt" IS NOT NULL AND
   (("type" = 'TEXT' AND "textContent" IS NOT NULL AND "audioUrl" IS NULL AND "voiceAssetId" IS NULL) OR
    ("type" = 'VOICE' AND "textContent" IS NULL AND "voiceAssetId" IS NOT NULL AND "audioDurationMs" IS NOT NULL AND "audioDurationMs" BETWEEN 1000 AND 180000 AND "audioUrl" IS NULL)))
);
ALTER TABLE "Letter" DROP CONSTRAINT "Letter_public_delivery_check";
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_public_delivery_check" CHECK (
  "destinationType" <> 'INFINITY' OR "status" <> 'DELIVERED' OR
  ("recipientId" IS NULL AND "id" ~ '^star_[a-f0-9-]{36}$' AND
   (("moderationPassed" IS TRUE AND NOT "moderationSkipped" AND "moderationCheckedAt" IS NOT NULL) OR
    ("moderationSkipped" AND "moderationPassed" IS NULL AND "moderationCheckedAt" IS NULL)) AND
   "stationeryJson" IS NOT NULL AND "deliveredAt" IS NOT NULL AND
   "posX" IS NOT NULL AND "posY" IS NOT NULL AND "posX" BETWEEN 0 AND 1600 AND "posY" BETWEEN 0 AND 1000 AND "audioUrl" IS NULL AND
   (("type" = 'TEXT' AND "textContent" IS NOT NULL AND "voiceAssetId" IS NULL AND "audioDurationMs" IS NULL) OR
    ("type" = 'VOICE' AND "textContent" IS NULL AND "voiceAssetId" IS NOT NULL AND "audioDurationMs" IS NOT NULL AND "audioDurationMs" BETWEEN 1000 AND 180000)))
);
