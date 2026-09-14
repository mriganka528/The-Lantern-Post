ALTER TABLE "Letter" ADD COLUMN "voiceCaption" TEXT;
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_voice_caption_check" CHECK (
  "voiceCaption" IS NULL OR ("type" = 'VOICE' AND "destinationType" <> 'BURNING' AND char_length("voiceCaption") BETWEEN 1 AND 2000)
);
ALTER TABLE "User" ADD COLUMN "diagnosticsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "diagnosticsKey" TEXT;
ALTER TABLE "User" ADD COLUMN "diagnosticsSince" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_diagnosticsKey_key" ON "User"("diagnosticsKey");
CREATE TABLE "DiagnosticsEvent" (
 "id" TEXT NOT NULL, "actorKey" TEXT NOT NULL, "name" TEXT NOT NULL, "platform" TEXT NOT NULL, "code" TEXT,
 "occurredAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "exportedAt" TIMESTAMP(3), "attempts" INTEGER NOT NULL DEFAULT 0, "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "DiagnosticsEvent_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "DiagnosticsEvent_name_check" CHECK ("name" IN ('SESSION_OPEN','DRAFT_SEALED','BURN_COMPLETED','FRIEND_DELIVERED','WORLD_SHARED','CLIENT_ERROR')),
 CONSTRAINT "DiagnosticsEvent_platform_check" CHECK ("platform" IN ('web','ios','android')),
 CONSTRAINT "DiagnosticsEvent_code_check" CHECK (("name"='CLIENT_ERROR' AND "code" IS NOT NULL AND "code" IN ('RENDER_ERROR','UNHANDLED_ERROR')) OR ("name" <> 'CLIENT_ERROR' AND "code" IS NULL))
);
CREATE INDEX "DiagnosticsEvent_actorKey_occurredAt_idx" ON "DiagnosticsEvent"("actorKey","occurredAt");
CREATE INDEX "DiagnosticsEvent_exportedAt_availableAt_idx" ON "DiagnosticsEvent"("exportedAt","availableAt");
