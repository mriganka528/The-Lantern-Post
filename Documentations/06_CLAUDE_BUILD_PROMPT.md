# Claude Build Prompt

Paste this into a new Claude conversation (ideally Claude Code, or claude.ai with the other 5 docs uploaded as context) to begin building Lantern Post phase by phase.

---

```
You are helping me build "Lantern Post" — a fairytale-themed mobile app (Expo/React Native for iOS + Android) where users write letters or record voice notes and release them to one of three destinations: a public "Infinity World," a specific friend's gate, or a cathartic "Burning World" where the message is destroyed.

I have four reference documents that fully define this project — treat them as the source of truth, not suggestions to second-guess:
1. PRD.md — product requirements, user journey, feature scope, explicit non-goals
2. ARCHITECTURE.md — system design: Expo client, NestJS API, PostgreSQL + Prisma, object storage + CDN, background job queue, scaling approach
3. TECH_STACK.md — exact technology choices (React Native/Expo, NestJS, PostgreSQL, Prisma, Redis/BullMQ, Expo Push, etc.)
4. DATA_MODEL.md — the Prisma schema to implement
5. IMPLEMENTATION_PLAN.md — a 12-phase build plan (Phase 0 through Phase 11), each phase producing something independently testable

[Attach or paste the contents of those 5 files here if they aren't already visible to you.]

## How I want you to work with me

- We will build this **one phase at a time**, in the order defined in IMPLEMENTATION_PLAN.md. Do not skip ahead or build multiple phases in one pass unless I explicitly ask.
- At the start of each phase, briefly restate what that phase's deliverable is, then implement it.
- Follow the tech stack and architecture documents exactly unless I explicitly approve a deviation — if you think a deviation is warranted, propose it and explain why before implementing it, don't just substitute silently.
- Keep the mobile client lightweight: vector/sprite animation (Lottie or Rive) over anything heavy (video, 3D); avoid adding native dependencies that would force us out of Expo's managed workflow unless there's no alternative.
- Enforce the safety/privacy rules from the architecture doc as you build them — especially: never serialize a sender's identity for an unsigned Infinity World letter, always check friend-authorization server-side on reads, and route anything destined for Infinity World or a friend through the moderation check before it's visible/delivered.
- After finishing a phase, tell me clearly what was built, what still needs my input or a design asset (e.g. character art, sound), and what the next phase will cover — then stop and wait for me to say "continue" or give feedback, rather than proceeding automatically.
- If something in the docs is ambiguous or you need a product decision from me (see PRD.md §8 "Open Questions" for known open items), ask me directly rather than guessing.

## Let's start

Begin with Phase 0 from IMPLEMENTATION_PLAN.md: project foundations (Expo app init, NestJS API init, PostgreSQL + Prisma setup using the schema in DATA_MODEL.md, and basic project structure). Walk me through what you're setting up and why, and flag anything you need from me (accounts, API keys, decisions) before you can proceed.
```

---

## Tips for using this prompt

- If using **Claude Code**, this prompt works well as your first message in a fresh repo — Claude Code can create files, run `npx create-expo-app`, `nest new`, etc. directly.
- If using **claude.ai chat**, upload the 5 reference `.md` files as attachments in the same message as this prompt so Claude has them as context, and expect to work more in "paste code into your own editor" mode rather than direct file execution.
- Keep each phase as its own conversation turn/session if the project starts to feel large — Claude will reference the docs fresh each time rather than relying on a long conversation history.
- Revisit `PRD.md §8 Open Questions` before Phase 6 (friends/delivery) and Phase 9 (Infinity World) — you'll want those product decisions locked in before Claude builds the features that depend on them.
