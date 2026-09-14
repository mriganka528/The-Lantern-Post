# Lantern Post

> Write it. Seal it. Let it go.

A fairytale-themed mobile app where users write letters or record voice notes and release them — to the world, to a friend, or into a cathartic fire — carried by a personal delivery-agent character through a beautifully illustrated storybook world.

## Documents in this set

- [`01_PRD.md`](./01_PRD.md) — Product Requirements Document: vision, user journey, feature breakdown, open questions
- [`02_ARCHITECTURE.md`](./02_ARCHITECTURE.md) — System architecture, client/server design, scaling plan
- [`03_TECH_STACK.md`](./03_TECH_STACK.md) — Full technology choices and rationale
- [`04_DATA_MODEL.md`](./04_DATA_MODEL.md) — Prisma schema and data modeling decisions
- [`05_IMPLEMENTATION_PLAN.md`](./05_IMPLEMENTATION_PLAN.md) — Phased build plan (12 phases, each independently testable)
- [`06_CLAUDE_BUILD_PROMPT.md`](./06_CLAUDE_BUILD_PROMPT.md) — Prompt to paste into a fresh Claude conversation (or Claude Code) to build this phase-by-phase
- [`09_ART_DIRECTION.md`](./09_ART_DIRECTION.md) — The user's enduring fairy-tale, heavenly, vintage visual direction
- [`10_PHASE_2_HANDOFF.md`](./10_PHASE_2_HANDOFF.md) — Character selection, palace homes, setup and verification
- [`11_PHASE_3_HANDOFF.md`](./11_PHASE_3_HANDOFF.md) — Writing desk, local drafts, stationery, sealing, and majestic palace motion
- [`12_PHASE_4_HANDOFF.md`](./12_PHASE_4_HANDOFF.md) — Burning World releases, retry receipts, and antique palace stationery
- [`13_PHASE_5_HANDOFF.md`](./13_PHASE_5_HANDOFF.md) — Friendship court, invitations, palace gates, notification wiring, and pending live setup
- [`14_ANDROID_NOTIFICATIONS_SETUP.md`](./14_ANDROID_NOTIFICATIONS_SETUP.md) — Android development APK, Expo project linking, Firebase/FCM setup, and phone testing
- [`15_PHASE_6_HANDOFF.md`](./15_PHASE_6_HANDOFF.md) — Private letters, journey preview, letterbox/reader, delivery recovery and deferred integrations
- [`16_PHASE_7_HANDOFF.md`](./16_PHASE_7_HANDOFF.md) — Persistent ambient motion, fresh writing after burning, voice recording/playback, private uploads and cleanup
- [`17_PHASE_8_HANDOFF.md`](./17_PHASE_8_HANDOFF.md) — Faster palace water, flying doves, celestial sealing, reporting, blocking and request limits
- [`18_PHASE_9_HANDOFF.md`](./18_PHASE_9_HANDOFF.md) — Infinity World, public text/voice, signature privacy, bounded sky browsing and sharing recovery
- [`19_PHASE_10_HANDOFF.md`](./19_PHASE_10_HANDOFF.md) — Free Royal Collection, Astral performance change, interactive stars, recovery, captions, support, retention and diagnostics
- [`20_STORE_LISTING_DRAFT.md`](./20_STORE_LISTING_DRAFT.md) — Brand assets, framed preview screenshots and draft store copy

## Quick facts

- **Platform:** iOS + Android (Expo/React Native), plus the browser preview requested during development
- **Backend:** Node.js/NestJS, PostgreSQL, Prisma
- **Storage:** S3-compatible object storage + CDN for voice notes and art assets
- **Core loop:** Compose → Seal → Choose Destination (Infinity World / Friend's Gate / Burning World) → Animated delivery → Confirmation

## Getting started

```bash
# From the repository root (use npm.cmd in Windows PowerShell)
npm install
npm run setup:env
# Configure DATABASE_URL and Clerk verification in server/.env.
npm run db:generate
npm run db:status
npm run db:deploy
npm run dev:server
# In another terminal:
npm run dev:web -- --clear
```

## Status

The main product features and refinements through [the account-menu update](./36_ACCOUNT_MENU_DIALOG_HANDOFF.md) are implemented. The user has confirmed real-account testing complete; Supabase voice storage and current database migrations are also user-confirmed working/applied. Native sharing code/packages are installed. See [the current remaining-work checklist](./37_RELEASE_STATUS.md) for Google Drive setup, legal details, public deployment/operations and deferred native, push and release work. Automated moderation remains an optional later update.

## License / Ownership

Set this before publishing anywhere public — currently unspecified.

Latest refinement: [Privacy, socket chat and direct Drive backups](27_PRIVACY_SOCKETS_BACKUPS_HANDOFF.md).

Latest release decision: [Normal delivery without automated moderation](28_UNREVIEWED_DELIVERY_HANDOFF.md). Real sending is enabled with unreviewed metadata; hosted moderation is deferred to a later update.

Latest storage work: [Free voice delivery and optional voice keepsakes](29_FREE_VOICE_STORAGE_HANDOFF.md).

Latest social work: [Live palace, independent copies and arrival alerts](30_LIVE_PALACE_HANDOFF.md).
