# Implementation Plan
## Lantern Post — Phased Build Plan

Each phase should produce something runnable/testable before moving on. Designed to be handed to Claude (or a dev team) phase by phase.

---

### Phase 0 — Foundations
- Initialize Expo app (TypeScript template, Expo Router)
- Initialize NestJS backend (TypeScript)
- Set up PostgreSQL (local Docker for dev) + Prisma, run first migration with the schema in `04_DATA_MODEL.md`
- Set up monorepo structure (optional but recommended: `apps/mobile`, `apps/api`, `packages/shared-types`)
- Set up environment config, `.env` handling, basic CI (lint + typecheck on push)
- **Deliverable:** empty app boots on iOS/Android simulator; API responds to a health-check endpoint; DB migrates cleanly

### Phase 1 — Auth & Identity
- Integrate managed auth (Supabase Auth or Clerk) client + server
- Build username selection/uniqueness check flow
- Build `User` creation on first login (linking `authProviderId`)
- **Deliverable:** a user can sign up, pick a username, and land on an empty home screen; session persists across app restarts

### Phase 2 — Character Selection & Palace (static)
- Seed `Character` table with MVP set (6–8 characters) + placeholder art
- Build character selection screen
- Build a static (non-decoratable) Palace home screen per character
- **Deliverable:** new user picks a character, sees their palace as the app's home screen

### Phase 3 — Compose Flow (text only first)
- Build the writing-desk UI (text letter, character limit)
- Build `Preset` selection UI (seed 5–10 presets as data)
- Wire "Seal" step → envelope visual
- **Deliverable:** user can write a letter, pick a preset, and reach a "sealed envelope" screen (not yet sent anywhere)

### Phase 4 — Send to Burning World (simplest destination first)
- Backend: `POST /letters` endpoint, `destinationType = BURNING`, moderation stubbed/optional here since nothing persists
- Client: confirmation step ("this can't be undone") → burn animation (Lottie) → return to palace
- **Deliverable:** full send loop works end-to-end for the simplest, lowest-risk destination

### Phase 5 — Friends
- Backend: `FriendRequest` endpoints (send/accept/decline), username search
- Client: friend search, requests list, friends list UI, gate icons in world
- Push notification wiring for friend request received/accepted
- **Deliverable:** two test accounts can become friends

### Phase 6 — Send to a Friend's Gate
- Backend: `destinationType = FRIEND`, moderation check before delivery, authorization checks on read
- Client: destination picker now includes friend selection; delivery animation walks to a specific friend's gate
- Push notification on delivery
- Recipient inbox/gate UI to view received letters (text + voice playback)
- **Deliverable:** full send-to-friend loop, including notification and receiving UI

### Phase 7 — Voice Notes
- Client: recording UI (`expo-av`/`expo-audio`), client-side compression, upload via signed URL to object storage
- Backend: signed upload URL endpoint, `audioUrl`/`audioDurationMs` handling
- Extend Burning World and Friend flows to support voice letters
- **Deliverable:** voice letters work through both existing destinations

### Phase 8 — Moderation Pipeline
- Backend: integrate hosted text moderation API, background job (BullMQ) for async checks, `moderationPassed` gating before a letter becomes visible/delivered
- Report & block endpoints + UI
- Rate limiting on send/friend-request endpoints
- **Deliverable:** abusive content is caught before reaching another user or the public world; users can report/block

### Phase 9 — Infinity World
- Backend: coordinate assignment on send, bounding-box query endpoint, `isSigned` enforcement in serialization
- Client: pannable/zoomable world canvas, virtualized sparkle rendering (viewport-based fetch), tap-to-reveal UI
- Extend destination picker to include Infinity World; delivery animation opens the infinity gate
- **Deliverable:** full three-destination send flow complete; public world is browsable and performant with many messages

### Phase 10 — Polish & Safety Hardening
- Crisis-resource surfacing for flagged emotional content (non-blocking)
- Soft-delete/hard-delete sweep job for Burning World + moderation removals
- Offline draft queue (local storage + retry on reconnect)
- Sentry, analytics events (D1/D7, time-to-first-send)
- Accessibility pass (font scaling, voice note captions/transcripts if feasible, screen reader labels)
- App icon, splash screen, store listing assets
- **Deliverable:** release-candidate build

### Phase 11 — Beta & Launch Prep
- TestFlight / Play Console internal testing
- Load-test the Infinity World read path and send path
- Finalize Terms of Service & Privacy Policy (retention policy, moderation policy, age requirement)
- EAS Build production builds, store submission
- **Deliverable:** public launch

---

## Suggested sequencing rationale
- Burning World before Friends/Infinity World: it's the simplest destination (no recipient, no public exposure), so it validates the whole compose→send→animate loop with the least risk.
- Moderation lands before Infinity World goes live: never ship public unmoderated content, even in beta.
- Voice notes are deliberately deferred past the first working text loop, since they add real infra (upload, storage, compression) that shouldn't block validating the core game loop.
