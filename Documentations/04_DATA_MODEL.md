# Data Model & Prisma Schema
## Lantern Post

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
- **`isSigned`** determines whether the API is allowed to serialize `senderId`/username in the public Infinity World response — enforce this in the API layer, not just the client.
- **Soft-delete pattern** (`softDeletedAt`, `hardDeleteAfter`) covers both the Burning World flow and moderation removals with one mechanism. A scheduled job purges `textContent`/`audioUrl` (and deletes the object storage file) once `hardDeleteAfter` passes.
- **`Character` and `Preset` are admin-managed content tables**, not user-generated — keeps art quality curated and makes adding seasonal content a data change, not a code change.
- **Palace is intentionally minimal in v1** (`palaceTheme` string on `User`) — promote to a full `Palace` model when you build the decoration/customization feature post-MVP.
