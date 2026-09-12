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

Phase 6 adds the private text-letter flow, continuous delivery journey, labelled preview and palace letterbox/reader. The user has deferred Android builds, live push and live moderation while the in-app product is built. The production moderation boundary stays closed until a real provider is configured; isolated test providers verify delivery during development. Follow the [Phase 6 handoff](./15_PHASE_6_HANDOFF.md) for the new migration and verified behaviour.

## License / Ownership

Set this before publishing anywhere public — currently unspecified.
