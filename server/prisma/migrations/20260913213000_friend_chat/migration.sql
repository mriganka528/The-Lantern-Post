CREATE TABLE "ChatThread" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "firstUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "secondUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "nextSequence" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatThread_pair_check" CHECK ("firstUserId" COLLATE "C" < "secondUserId" COLLATE "C"),
  CONSTRAINT "ChatThread_sequence_check" CHECK ("nextSequence" >= 0)
);
CREATE UNIQUE INDEX "ChatThread_firstUserId_secondUserId_key" ON "ChatThread"("firstUserId", "secondUserId");
CREATE TABLE "ChatMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "threadId" TEXT NOT NULL REFERENCES "ChatThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "sequence" INTEGER NOT NULL,
  "senderId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "text" TEXT NOT NULL,
  "moderationPassed" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatMessage_content_check" CHECK ("moderationPassed" AND char_length(btrim("text")) BETWEEN 1 AND 2000),
  CONSTRAINT "ChatMessage_sequence_check" CHECK ("sequence" > 0)
);
CREATE UNIQUE INDEX "ChatMessage_threadId_sequence_key" ON "ChatMessage"("threadId", "sequence");
CREATE TABLE "ChatReceipt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ownerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "peerId" TEXT NOT NULL,
  "outcome" "DeliveryOutcome" NOT NULL,
  "reason" TEXT,
  "messageId" TEXT,
  "sequence" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatReceipt_outcome_check" CHECK (
    ("outcome" = 'DELIVERED' AND "reason" IS NULL AND "messageId" IS NOT NULL AND "sequence" IS NOT NULL AND "sequence" > 0) OR
    ("outcome" = 'REJECTED' AND "messageId" IS NULL AND "sequence" IS NULL AND "reason" IS NOT NULL AND "reason" IN ('CANCELLED', 'FRIEND_UNAVAILABLE', 'CONTENT_NOT_ALLOWED', 'DAILY_LIMIT'))
  )
);
CREATE UNIQUE INDEX "ChatReceipt_messageId_key" ON "ChatReceipt"("messageId");
CREATE INDEX "ChatReceipt_ownerId_createdAt_idx" ON "ChatReceipt"("ownerId", "createdAt");
CREATE TABLE "ChatReport" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "messageId" TEXT NOT NULL REFERENCES "ChatMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "reporterId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "reason" "ReportReason" NOT NULL,
  "detail" TEXT,
  "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatReport_detail_check" CHECK ("detail" IS NULL OR char_length("detail") <= 500)
);
CREATE UNIQUE INDEX "ChatReport_messageId_reporterId_key" ON "ChatReport"("messageId", "reporterId");
CREATE INDEX "ChatReport_status_createdAt_idx" ON "ChatReport"("status", "createdAt");
