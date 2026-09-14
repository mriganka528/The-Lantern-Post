# Data Model & Prisma Schema
## Lantern Post

Phase 10 adds the Royal catalogue, optional `Letter.voiceCaption`, private opt-in diagnostic preferences and constrained `DiagnosticsEvent` rows. Diagnostic actor keys are random per consent epoch; opt-out clears events. Draft v6 adds voice captions while migrating versions 1–5. The retention sweep clears due deleted content and old unreported audit stubs while preserving all operation receipts. See `19_PHASE_10_HANDOFF.md` and the executable Prisma schema.

Phase 9 adds owner-scoped `WorldReceipt` outcomes, random public letter IDs, a viewport index/coordinate constraints, destination-bound voice assets and anonymous block aliases. Public responses explicitly omit sender identity unless signed. Draft v5 adds a public intent/receipt while preserving v1–v4 recovery. See `18_PHASE_9_HANDOFF.md`; the executable schema remains `server/prisma/schema.prisma`.

Phase 8 adds short-lived `RequestWindow` budgets shared across server processes, unique recipient/letter reports and no-self block/report constraints. Blocking changes friendship to `BLOCKED`; unblocking does not restore acceptance. See `17_PHASE_8_HANDOFF.md` and the executable schema.

Phase 7 adds `VoiceAsset` (`UPLOADING`, `READY`, `ATTACHED`, `DELETED`) with owner/request uniqueness, recipient binding, bounded audio metadata, private object keys and cleanup timestamps. `Letter.voiceAssetId` replaces persistent URLs for private voice delivery; authorised playback URLs are generated when opened. Draft-v4 audio deletion queues are local client data. The executable schema is `server/prisma/schema.prisma`; see `16_PHASE_7_HANDOFF.md` for its migration and lifecycle. The foundational model below remains historical context.

Phase 4 adds a `BurnOutcome` enum and a `BurnReceipt` model linked to `User`, for durable owner-scoped release outcomes without retaining letter content. The executable current schema is `server/prisma/schema.prisma`; details and migration behaviour are in `12_PHASE_4_HANDOFF.md`. The foundational model below predates that addition.

This is a starting schema — refine field names/enums as you build, but the shape (entities + relations) should hold.

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum LetterType {
  TEXT
  VOICE
}

enum LetterDestinationType {
  INFINITY
  FRIEND
  BURNING
}

enum LetterStatus {
  DRAFT
  SENDING
  DELIVERED
  SOFT_DELETED   // burned messages after animation, or reported+removed
  HARD_DELETED   // retained only as an audit stub, content purged
}

enum FriendRequestStatus {
  PENDING
  ACCEPTED
  DECLINED
  BLOCKED
}

enum ReportReason {
  HARASSMENT
  SPAM
  HATE_SPEECH
  SELF_HARM_CONCERN
  OTHER
}

enum ReportStatus {
  OPEN
  REVIEWED
  ACTIONED
  DISMISSED
}

model User {
  id            String   @id @default(cuid())
  username      String   @unique
  authProviderId String  @unique   // id from Supabase Auth / Clerk / etc.
  characterId   String?
  character     Character? @relation(fields: [characterId], references: [id])
  palaceTheme   String?    // simple config key for MVP; expand to a Palace model post-MVP
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  sentLetters       Letter[]           @relation("SentLetters")
  receivedLetters   Letter[]           @relation("ReceivedLetters")
  friendRequestsSent     FriendRequest[] @relation("RequestsSent")
  friendRequestsReceived FriendRequest[] @relation("RequestsReceived")
  reportsFiled      Report[]           @relation("ReportsFiled")
  reportsAgainst    Report[]           @relation("ReportsAgainst")
  blockedUsers      Block[]            @relation("Blocker")
  blockedByUsers    Block[]            @relation("Blocked")
  pushTokens        PushToken[]

  @@index([username])
}

model Character {
  id          String  @id @default(cuid())
  key         String  @unique   // e.g. "fox-lantern", "owl-scholar"
  displayName String
  assetUrl    String            // CDN URL to sprite/animation bundle
  isActive    Boolean @default(true)  // curated set can be toggled without deleting history
  users       User[]
}

model Preset {
  id          String  @id @default(cuid())
  key         String  @unique
  displayName String
  configJson  Json     // paper texture, seal color, border, font — data-driven
  isSeasonal  Boolean  @default(false)
  isActive    Boolean  @default(true)
  letters     Letter[]
}

model Letter {
  id              String   @id @default(cuid())
  senderId        String
  sender          User     @relation("SentLetters", fields: [senderId], references: [id])
  recipientId     String?           // only set for FRIEND destination
  recipient       User?    @relation("ReceivedLetters", fields: [recipientId], references: [id])

  type            LetterType
  destinationType LetterDestinationType
  textContent     String?           // for TEXT type
  audioUrl        String?           // for VOICE type, CDN/signed URL reference
  audioDurationMs Int?

  presetId        String?
  preset          Preset?  @relation(fields: [presetId], references: [id])

  isSigned        Boolean  @default(false)   // "Sign it" — reveal sender username publicly
  posX            Float?             // Infinity World coordinate
  posY            Float?             // Infinity World coordinate

  status          LetterStatus @default(SENDING)
  moderationPassed Boolean?          // null = pending, true/false = result
  moderationCheckedAt DateTime?

  createdAt       DateTime @default(now())
  deliveredAt     DateTime?
  softDeletedAt   DateTime?
  hardDeleteAfter DateTime?          // scheduled purge time for BURNING/removed content

  reports         Report[]

  @@index([destinationType, posX, posY])   // Infinity World bounding-box queries
  @@index([recipientId, status])           // friend gate inbox queries
  @@index([hardDeleteAfter])               // sweep job
}

model FriendRequest {
  id          String   @id @default(cuid())
  fromUserId  String
  fromUser    User     @relation("RequestsSent", fields: [fromUserId], references: [id])
  toUserId    String
  toUser      User     @relation("RequestsReceived", fields: [toUserId], references: [id])
  status      FriendRequestStatus @default(PENDING)
  createdAt   DateTime @default(now())
  respondedAt DateTime?

  @@unique([fromUserId, toUserId])
}

model Block {
  id          String   @id @default(cuid())
  blockerId   String
  blocker     User     @relation("Blocker", fields: [blockerId], references: [id])
  blockedId   String
  blocked     User     @relation("Blocked", fields: [blockedId], references: [id])
  createdAt   DateTime @default(now())

  @@unique([blockerId, blockedId])
}

model Report {
  id          String   @id @default(cuid())
  letterId    String
  letter      Letter   @relation(fields: [letterId], references: [id])
  reporterId  String
  reporter    User     @relation("ReportsFiled", fields: [reporterId], references: [id])
  reportedUserId String
  reportedUser   User  @relation("ReportsAgainst", fields: [reportedUserId], references: [id])
  reason      ReportReason
  detail      String?
  status      ReportStatus @default(OPEN)
  createdAt   DateTime @default(now())
  resolvedAt  DateTime?
}

model PushToken {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  token     String   @unique
  platform  String   // "ios" | "android"
  createdAt DateTime @default(now())
}
```

## Notes on key decisions

- **Friendship modeled via `FriendRequest`**, not a separate `Friendship` table — a pair is "friends" when a request exists with `status = ACCEPTED`. Simpler for MVP; split into a dedicated `Friendship` join table later if you need friendship-specific metadata (e.g. custom gate art per friend).
- **`posX`/`posY` on `Letter`** rather than a separate spatial table — keeps the bounding-box query a single indexed lookup. Assign coordinates server-side on send (semi-random within current "world bounds") so users can't claim/grief positions.
- **`isSigned`** permits a public username signature only. Public markers/readers never expose `senderId`, account IDs, companion details or private social cards. Enforce this in the API layer, not just the client.
- **Soft-delete pattern** (`softDeletedAt`, `hardDeleteAfter`) covers both the Burning World flow and moderation removals with one mechanism. A scheduled job purges `textContent`/`audioUrl` (and deletes the object storage file) once `hardDeleteAfter` passes.
- **`Character` and `Preset` are admin-managed content tables**, not user-generated — keeps art quality curated and makes adding seasonal content a data change, not a code change.
- **Palace is intentionally minimal in v1** (`palaceTheme` string on `User`) — promote to a full `Palace` model when you build the decoration/customization feature post-MVP.

## Phase 11 local correspondence cabinet

The social refinement also adds `ChatThread` (two canonical participants and a transactionally incremented sequence), moderated `ChatMessage`, content-free owner/request/peer-bound `ChatReceipt`, and recipient-owned `ChatReport`. The live transcript is bounded in memory; only unsent/confirmed-pending chat drafts persist locally, keyed by an encoded account/peer tuple. Current friendship and both block directions gate all history/live reads. See `26_SOCIAL_PARLOUR_HANDOFF.md`; future account-erasure work must handle these relations and retention explicitly.

The cabinet adds no server table or migration. Each account/device can keep independent v6 `LetterDraft` documents. The existing `lantern-draft-v1-{encodedOwner}` key remains the original entry, preserving all v1–v6 upgrade and receipt recovery behaviour. New letters use `lantern-letter-v1-{encodedOwner}--{UUID}` keys. Each document has its own generation ID, kind, stationery snapshot, content, voice deletion queue and confirmed-operation UUID. The selected-document pointer is optional UI state; enumeration does not depend on a shared mutable index.

Storage is browser localStorage / native app documents; voice bytes remain in the existing account-scoped IndexedDB / app document store. The cabinet displays at most 12 entries at once, with further pages on request. Voice captions, recipient/account identifiers, and pending/completed text are excluded from list labels. Completed letters keep only their cleared document and durable receipt; they do not become a content archive.

Opening a different page remounts its editor/controller. In-flight receipts remain attached to the original document. Only the active editor may recover a confirmed network operation; a separate foreground, local-only worker clears queued recordings for inactive owned letters. Failed deletions remain durably queued. An explicit external copy is generated from an owned writing/sealed document and never mutates its stage or sends through the delivery API.
