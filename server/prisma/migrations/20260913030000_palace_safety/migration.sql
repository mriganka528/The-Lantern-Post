CREATE UNIQUE INDEX "Report_reporterId_letterId_key" ON "Report"("reporterId", "letterId");
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");
ALTER TABLE "Block" ADD CONSTRAINT "Block_no_self" CHECK ("blockerId" <> "blockedId");
ALTER TABLE "Report" ADD CONSTRAINT "Report_no_self" CHECK ("reporterId" <> "reportedUserId");
CREATE TABLE "RequestWindow" (
  "id" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RequestWindow_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RequestWindow_positive_count" CHECK ("count" > 0)
);
CREATE INDEX "RequestWindow_expiresAt_idx" ON "RequestWindow"("expiresAt");
