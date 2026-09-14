# Implementation Plan

Current active task: Render as the default backend for browser and Android, with explicit local operation available. The user reports deploying `https://the-lantern-post.onrender.com`; follow [41_RENDER_DEFAULT_HANDOFF.md](./41_RENDER_DEFAULT_HANDOFF.md) for the new development-browser origin setting, mode commands and hosted checks. Generic browser real-account testing and the first Android setup remain user-confirmed complete; the separate device checklist and new hosted regression check remain unconfirmed.

Current status: see [37_RELEASE_STATUS.md](./37_RELEASE_STATUS.md). The user has confirmed real-account testing complete. Supabase voice storage and current database migrations are user-confirmed working/applied. Remaining items are Google Drive OAuth setup, legal details, public deployment/operations, and the separately deferred native/push/release work. Earlier phase handoffs record their status at the time they were written.

Social refinement: `30_LIVE_PALACE_HANDOFF.md` adds owner-scoped live updates/arrival alerts, independent private-letter deletion, faster chat/audio delivery, royal username plaques and prominent home navigation. Its migration belongs to the user-confirmed completed migration work. Phone notifications are prepared, with actual Android setup still deferred by the user's browser-only choice.

Storage refinement: `29_FREE_VOICE_STORAGE_HANDOFF.md` implements no-card Supabase Free voice delivery, authenticated API uploads, local recording and optional encrypted Drive voice keepsakes. Supabase is now configured and user-confirmed working; direct Drive OAuth setup remains separate. No new database migration is required.

Latest release decision (14 September 2026): automated moderation is disabled. Real chat, friend letters and Infinity publication work without a provider, with explicit unreviewed records. Hosted moderation, workers and an administrator review screen are deferred to a later update after getting users. See `28_UNREVIEWED_DELIVERY_HANDOFF.md`. Existing user reports, blocks, limits, confirmation and recovery remain active.
## Lantern Post — Phased Build Plan

Previous refinement: `26_SOCIAL_PARLOUR_HANDOFF.md` adds username calling cards, the illustrated sealed-letter destination court, moderated friend-chat infrastructure, and home sections ordered writing desk → friendship gates → worlds → companion/rest. On 14 September 2026 the user confirmed applying the chat migration with `npm.cmd run db:deploy`; live moderation stays deferred. The original plan still ends at Phase 11.

Each phase should produce something runnable/testable before moving on. Designed to be handed to Claude (or a dev team) phase by phase.

Current implementation: **Phase 11 preparation and later product refinements**, with the main in-app flows, multi-letter cabinet, privacy/account removal, native sharing code, socket chat, and encrypted local/Drive backup integration implemented. The user confirmed completing the current database migrations, including privacy/Drive and optional content review. Remaining work is live configuration, real provider/device acceptance, final legal/contact details, monitoring, staging load checks and beta/store release. Automated moderation is optional future-update work by the latest user decision. Android/EAS/Firebase setup remains deferred. No public release has been made, and the original plan has no Phase 12.

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
- **Current status (13 September 2026):** in-app improvements, isolated load rehearsals, age-13 policy review pages and a release runbook are prepared; see `21_PHASE_11_HANDOFF.md`. Native builds, live services and public launch remain deferred. Policy contacts/operator details and native file-sharing device verification are still pending; packages and native sharing code are installed.
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

## Post-phase-11 privacy and chat refinement

Account removal/privacy controls, native image/audio export implementation, authenticated socket chat, local encrypted archives and direct Google Drive OAuth/backups are implemented. See `27_PRIVACY_SOCKETS_BACKUPS_HANDOFF.md`. New database deployment, real Google OAuth configuration/acceptance and native device acceptance remain operator steps; APK/EAS/push and live moderation remain deferred.
