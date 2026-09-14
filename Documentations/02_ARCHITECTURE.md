# Architecture Document
## Lantern Post — System Architecture

Phase 10 update: confirmed pending drafts recover in the foreground using receipt lookup, current capability checks and the same UUID, with bounded backoff. Voice captions are local content until separately moderated for delivery. Support suggestions stay local and non-blocking. Retention preserves operation receipts. Optional diagnostics use server-owned consent and fixed event/error codes; a sanitized Sentry-envelope forwarder is prepared but unconfigured, with no native crash SDK or raw-content capture. See `19_PHASE_10_HANDOFF.md`.

Phase 9 update: Infinity World fetches approved marker pages by viewport, keeps at most 180 client markers and groups nearby stars. Content is loaded only on opening. Explicit public serializers hide unsigned identity, including report/block responses, and both block directions filter reads. Text/voice publication uses a separate durable outcome, moderation gate and local cleanup fence. Labelled bundled samples keep the world explorable without live moderation. See `18_PHASE_9_HANDOFF.md`.

Implementation update: Phase 7 uses Expo Audio on native and MediaRecorder on web, local per-owner audio bytes, and draft-v4 cleanup queues. Private upload staging is validated and copied to a sealed key before voice moderation/delivery; playback uses authorised short-lived signed URLs, without a public audio CDN. Burning audio is never uploaded. See `16_PHASE_7_HANDOFF.md`; live moderation and storage setup remain deferred. The diagrams below describe the broader planned architecture.

---

## 1. Guiding Principles

1. **Thin client, simple server.** The "game" (delivery animation) is entertainment layered on top of what is really a CRUD app with media upload and a moderated public feed. Don't over-engineer real-time infrastructure for an animation that doesn't need to be synced across devices.
2. **Small app footprint.** No 3D engine, no heavy game engine. Vector/sprite animation (Lottie/Rive) keeps the Expo bundle small and runs on low-end devices.
3. **Moderation before persistence.** Anything that becomes publicly visible or reaches another user is checked before it's committed, not after.
4. **Boring, scalable backend.** Managed Postgres + a stateless API layer that can horizontally scale. No custom infrastructure to operate in year 1.

---

## 2. High-Level System Diagram (textual)

```
┌─────────────────────────┐
│   Expo / React Native   │
│   (iOS, Android, +Web)  │
│                          │
│  - Onboarding/Auth UI    │
│  - Compose UI            │
│  - Delivery animation    │
│    (Lottie/Rive, local)  │
│  - Infinity World map    │
│  - Friends & Palace UI   │
└───────────┬──────────────┘
            │ HTTPS (REST/JSON, tRPC or REST+OpenAPI)
            ▼
┌─────────────────────────┐        ┌─────────────────────┐
│   API Server (Node.js)  │◄──────►│  Auth Provider        │
│   NestJS or Fastify     │        │  (Clerk/Auth0/Supabase│
│                          │        │   Auth, or custom JWT)│
│  - REST/tRPC endpoints   │        └─────────────────────┘
│  - Moderation pipeline   │
│  - Rate limiting         │        ┌─────────────────────┐
│  - Push notif trigger    │◄──────►│  Object Storage (S3/  │
└───────────┬──────────────┘        │  Cloudflare R2) +CDN  │
            │ Prisma ORM             │  for voice notes,     │
            ▼                        │  character/palace art │
┌─────────────────────────┐        └─────────────────────┘
│   PostgreSQL (managed)   │
│   e.g. Supabase / Neon / │        ┌─────────────────────┐
│   RDS                    │        │  Push Notifications   │
└─────────────────────────┘        │  (Expo Push Service)  │
                                     └─────────────────────┘
            ▲
            │ (async jobs)
┌─────────────────────────┐
│  Background Worker Queue │
│  (e.g. BullMQ + Redis)   │
│  - Text moderation calls │
│  - Voice transcoding     │
│  - Old-flag hard-delete  │
│    sweep (Burning World) │
└─────────────────────────┘
```

---

## 3. Client Architecture (Expo / React Native)

- **Framework:** Expo (managed workflow where possible; use EAS Build/Dev Client if a native module forces a bare workflow dependency)
- **Navigation:** Expo Router (file-based, works across iOS/Android/Web)
- **State/data:** TanStack Query (server cache) + Zustand or Jotai (local/UI state) — avoid Redux boilerplate for this scope
- **Animation:** `lottie-react-native` and/or `react-native-reanimated` + `react-native-skia` for the world/gate/character scenes; Rive is a strong alternative if you want interactive state-machine-driven character animation
- **Forms/compose:** local-first draft storage via `expo-sqlite` or `AsyncStorage`, so a half-written letter is never lost
- **Audio:** `expo-av` (or `expo-audio` in newer SDKs) for recording; compress client-side (AAC/Opus) before upload
- **Offline queue:** failed/offline sends are queued locally and retried (e.g. via TanStack Query's mutation persistence, or a small custom queue) — this satisfies "offline drafting" from the PRD
- **Infinity World rendering:** a virtualized/clustered canvas — only render sparkle nodes within the current viewport bounding box, fetched via a spatial query (see §5). Do NOT render thousands of nodes at once.
- **Bundle size discipline:** vector assets (SVG/Lottie JSON) over PNG/video wherever possible; lazy-load palace/character asset packs per-character rather than bundling all of them.

---

## 4. Backend Architecture

- **Runtime:** Node.js (LTS) + TypeScript throughout, for a single language across client/server
- **Framework:** NestJS (structure/DI helps as this grows: auth, letters, friends, moderation, notifications as modules) — Fastify alone is a lighter alternative if you want less framework overhead
- **API style:** REST with OpenAPI schema (simplest to consume from Expo, easiest to reason about for rate limiting/caching) — tRPC is a viable alternative if you want end-to-end TS types and are comfortable with its coupling
- **Auth:** Recommend a managed auth provider for MVP (Supabase Auth or Clerk) to avoid building password reset/session security yourself. Store only the `authProviderId` + your own `User` row in Postgres.
- **ORM:** Prisma, against PostgreSQL (per your requirement)
- **Background jobs:** Redis-backed queue (BullMQ) for:
  - Async moderation checks (so sending doesn't block on a 3rd-party classifier call)
  - Voice note transcoding/validation
  - Scheduled hard-delete sweep for expired Burning World soft-deletes
  - Push notification dispatch
- **Rate limiting:** per-user token bucket (e.g. `nestjs-rate-limiter` or a Redis-backed limiter) on send-letter and friend-request endpoints
- **Moderation:** start with a hosted text-moderation API (e.g. a moderation endpoint from your LLM provider, or a dedicated service like Hive/OpenAI moderation) for text; voice notes get lightweight validation at MVP and a manual-review queue when reported

---

## 5. Data & Storage Strategy

- **PostgreSQL** — all structured data: users, characters, friendships, letters (metadata + text content), moderation flags, reports
- **Object storage (S3-compatible, e.g. Cloudflare R2 for cheaper egress)** — voice note audio files, character/palace art assets, user-uploaded... (none planned for MVP, curated art only)
- **CDN in front of object storage** — art assets and audio served via CDN, not directly from your API
- **Infinity World spatial queries** — store each public letter with a `(x, y)` or `(lat,lng)-style` coordinate in its "sky." Use a simple bounding-box query (`WHERE x BETWEEN ... AND y BETWEEN ...`) with a composite index; this is plenty at social-app scale and avoids needing PostGIS. If the world grows very large, PostGIS is a drop-in upgrade path.
- **Caching:** Redis cache for hot reads — Infinity World viewport queries, friend lists — to keep Postgres load down at scale.

---

## 6. Scaling Plan (handling "a large number of users")

| Concern | MVP approach | Scale-up path |
|---|---|---|
| API servers | Single small instance/container | Stateless API → horizontal autoscaling behind a load balancer (Render/Fly.io/ECS) |
| Database | Single managed Postgres instance | Read replicas for Infinity World reads; connection pooling via PgBouncer/Prisma Accelerate |
| Media | Direct-to-object-storage upload via signed URLs (client uploads directly, not through API server) | CDN cache tuning, multi-region storage if needed |
| Infinity World reads | Bounding-box query + Redis cache | Precomputed spatial tiles/clusters, background job to bucket stars into grid cells |
| Moderation | Synchronous-ish (fast API call) with async fallback | Dedicated moderation queue + human review dashboard |
| Push notifications | Expo Push Service directly | Batch via background worker if volume grows |

This keeps the MVP genuinely simple (a Node API + Postgres + object storage + one background worker) while leaving clear, boring upgrade paths — no premature infrastructure investment.

---

## 7. Security & Privacy Notes

- All media access via **signed, time-limited URLs** — never public-write buckets
- Friend-only letters: enforce authorization server-side on every read (never trust client-side "is this my friend" checks)
- Infinity World "Sign it" opt-in: store the sender's choice per-message; never leak `userId` in the API payload for unsigned messages (not just hidden in the UI — actually omit it from the response)
- Burning World, as implemented in Phase 4: validate text in memory and discard it without storing it. Keep only a `HARD_DELETED` audit stub and an owner-scoped release receipt. No content-reading or recovery endpoint is available. The older retention-window proposal is not activated; see `12_PHASE_4_HANDOFF.md` before changing this behaviour.
- Standard: HTTPS everywhere, hashed/managed auth (never store raw passwords if you roll your own), input validation (`zod`/`class-validator`) on every endpoint, parameterized queries (Prisma handles this by default)

---

## 8. Why not X?

- **Why not Firebase/Firestore instead of Postgres?** You specified Postgres + Prisma; also, the relational structure here (users, friendships, letters, moderation flags, reports) is a natural fit for relational data and the bounding-box query pattern.
- **Why not a real game engine (Unity/Godot)?** Massive bundle size and overkill for 2D sprite/vector animation; would fight against "not too bulky" and Expo's multi-OS story.
- **Why not real-time sockets for the delivery walk?** Nothing needs to be synced live between users — simulating it client-side after a successful API response is simpler, cheaper, and just as delightful.
