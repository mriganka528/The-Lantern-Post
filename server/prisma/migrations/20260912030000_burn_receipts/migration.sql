CREATE TYPE "BurnOutcome" AS ENUM ('BURNED', 'REJECTED');

CREATE TABLE "BurnReceipt" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "outcome" "BurnOutcome" NOT NULL,
  "reason" TEXT,
  "letterId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BurnReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BurnReceipt_outcome_check" CHECK (
    ("outcome" = 'BURNED' AND "reason" IS NULL AND "letterId" IS NOT NULL)
    OR ("outcome" = 'REJECTED' AND "reason" IS NOT NULL AND "reason" = 'PRESET_UNAVAILABLE' AND "letterId" IS NULL)
  )
);

CREATE UNIQUE INDEX "BurnReceipt_letterId_key" ON "BurnReceipt"("letterId");
CREATE INDEX "BurnReceipt_ownerId_idx" ON "BurnReceipt"("ownerId");
ALTER TABLE "BurnReceipt" ADD CONSTRAINT "BurnReceipt_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
