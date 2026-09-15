-- Each participant may hide their own copy. Unsend retains the message ID and
-- original sequence/receipt while clearing readable text through erasedAt.
ALTER TABLE "ChatMessage"
  ADD COLUMN "senderDeletedAt" TIMESTAMP(3),
  ADD COLUMN "recipientDeletedAt" TIMESTAMP(3);
