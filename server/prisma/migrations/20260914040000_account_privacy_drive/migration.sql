ALTER TABLE "User" ADD COLUMN "accountState" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "User" ADD CONSTRAINT "User_accountState_check" CHECK ("accountState" IN ('ACTIVE', 'DELETING', 'DELETED'));
ALTER TABLE "ChatMessage" ADD COLUMN "erasedAt" TIMESTAMP(3);
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_content_check";
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_content_check" CHECK (
  ("erasedAt" IS NULL AND "moderationPassed" AND char_length(btrim("text")) BETWEEN 1 AND 2000) OR
  ("erasedAt" IS NOT NULL AND "text" = '')
);
CREATE TABLE "AccountDeletion" (
  "id" TEXT PRIMARY KEY,
  "ownerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "subjectHash" TEXT NOT NULL,
  "providerSubject" TEXT,
  "diagnosticsKey" TEXT,
  "state" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("state" IN ('PENDING', 'COMPLETE')),
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedUntil" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT
);
CREATE UNIQUE INDEX "AccountDeletion_ownerId_key" ON "AccountDeletion"("ownerId");
CREATE UNIQUE INDEX "AccountDeletion_subjectHash_key" ON "AccountDeletion"("subjectHash");
CREATE INDEX "AccountDeletion_state_availableAt_idx" ON "AccountDeletion"("state", "availableAt");
CREATE TABLE "DriveConnection" (
  "ownerId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "encryptedRefreshToken" TEXT NOT NULL,
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activeUntil" TIMESTAMP(3)
);
CREATE TABLE "DriveLink" (
  "id" TEXT PRIMARY KEY,
  "ownerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "stateHash" TEXT NOT NULL,
  "encryptedVerifier" TEXT,
  "encryptedCleanupToken" TEXT,
  "exchangingUntil" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','CONNECTED','FAILED','CANCELLED')),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "DriveLink_stateHash_key" ON "DriveLink"("stateHash");
CREATE INDEX "DriveLink_ownerId_expiresAt_idx" ON "DriveLink"("ownerId", "expiresAt");
