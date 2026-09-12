# Product Requirements Document (PRD)
## Working Title: Lantern Post — A Fairytale Letter World

**Version:** 0.1 (Draft for review)
**Platform:** Mobile (iOS + Android via Expo/React Native)
**Owner:** You (Product Owner) — drafted with Claude

---

## 1. Vision

Lantern Post is an emotional-expression app disguised as a fairytale game. Users write, type, or record letters and "release" them — to the world, to a friend, or into a cathartic fire — carried by a personal delivery-agent character through a beautifully illustrated storybook world. The core feeling is: *say what you need to say, and let it go, beautifully.*

This is not a messaging app. It is closer to a cross between a journaling app, a cozy game, and a lightweight social network — where the act of "sending" is itself the emotional payoff.

---

## 2. Problem & Motivation

People need low-stakes ways to express thoughts and feelings they can't or don't want to say to a real person directly — venting, gratitude, grief, joy, confessions — without the social cost of posting on a normal social network (likes, comments, permanence, identity exposure). Existing options are either:
- Private journaling apps (no sense of "release" or ritual)
- Public social media (too exposed, too permanent, too performative)
- Direct messaging (requires a real relationship, real stakes)

Lantern Post sits in between: ritualized, beautiful, low-stakes release, with an optional social layer (friends) for real connection.

---

## 3. Target Users

- People who journal or want to but find blank pages intimidating
- People processing a specific emotion (anger, grief, love, nostalgia) who want a symbolic ritual
- People who enjoy cozy/narrative games (Animal Crossing, Spiritfarer, Florence audiences)
- Long-distance friend groups who want a whimsical, non-real-time way to stay in touch

**Not the target for v1:** Enterprise, teams, anyone needing real-time chat.

---

## 4. Core User Journey

1. **Onboard** → choose username, choose a character (avatar), the character's palace is generated as their home base.
2. **Compose** → from the palace, open the writing desk: type a letter, or record a voice note. Optionally apply a preset (paper texture, wax seal color, border, font).
3. **Seal** → the letter animates into an envelope, sealed with wax.
4. **Choose destination:**
   - **Infinity World** — released publicly, appears as a sparkle/star; hover/tap reveals content (and username only if the sender chose "Sign it")
   - **A Friend's Gate** — delivered privately to one specific friend
   - **The Burning World** — destroyed in a cathartic burn animation; not stored long-term
5. **Delivery ritual (animated, client-side)** → the user's character walks the envelope to a delivery room, hands it to the Delivery Agent character, who walks through the world and opens the correct destination gate.
6. **Confirmation** → user sees a short "delivered" moment (different flavor per destination).
7. **Receiving (if applicable)** → friend gets a push notification, opens their palace gate, finds the letter waiting.

---

## 5. Feature Breakdown

### 5.1 Identity & Characters
- Username-based identity (unique, changeable with cooldown)
- Choose 1 character avatar from a curated set (MVP: 6–8 characters)
- Each character has a **Palace** — a personal visual space that can be decorated over time (post-MVP)
- Profile is minimal: username, character, join date, palace. No bios/follower counts (keep low-stakes)

### 5.2 Composing
- Text letters (with character limit, e.g. 2,000 chars for MVP)
- Voice note letters (max duration e.g. 3 minutes for MVP; compressed client-side)
- **Presets**: data-driven templates controlling paper texture, seal wax color, ribbon, border ornament, font. Ship with ~10 presets at launch; unlockable/seasonal presets later.
- Draft autosave (local), so a half-written letter survives app close.

### 5.3 Sending / Destinations
| Destination | Visibility | Persistence | Notes |
|---|---|---|---|
| Infinity World | Public | Permanent (with soft-delete/report handling) | Appears as sparkle/star at a position in a shared "sky" or "meadow" map. Anonymous by default; sender can opt to "Sign it" (reveal username on tap). |
| Friend's Gate | Private, 1 recipient | Permanent until recipient/sender deletes | Requires mutual friendship. Push notification to recipient. |
| Burning World | Nobody | Soft-deleted after burn animation, hard-deleted after retention window (default 30 days, safety/legal only — not user-visible or re-readable) | Cathartic; message is not recoverable by the user after burning. |

### 5.4 Delivery Animation (the "game" layer)
- Fully client-side, sprite/vector based (Lottie/Rive), triggered after the backend confirms the send succeeded
- Sequence: envelope created → character walks to delivery room → gate opens → hands to Delivery Agent → Agent walks → opens destination gate → item placed
- Different short "arrival" animation per destination (sparkle rises into sky / letter slides under a gate / paper curls into flame)
- Must be skippable (tap to skip) for repeat users

### 5.5 Social Layer
- Send / accept / decline friend requests by username search
- Friends list, each friend shown as a small gate icon in the user's world
- No public feed, no comments, no likes — the *only* public surface is the Infinity World sparkle field
- Block & report (per-user and per-message)

### 5.6 Infinity World (public space)
- Rendered as a navigable "sky" or "meadow" — pan/zoom
- Messages shown as sparkle/star icons, positioned semi-randomly (not user-chosen coordinates, to avoid griefing/claiming spots)
- Tap a sparkle → reveals content (text) or plays voice note; shows username only if sender opted to sign
- Spatial pagination/clustering — only load stars in current viewport, fetch more on pan (see Architecture doc)
- Report button on every opened message

### 5.7 Notifications
- Push (Expo Notifications): friend request received/accepted, letter delivered to your gate
- No push for Infinity World activity (keeps it calm, not addictive-by-design)

### 5.8 Safety & Moderation (see also Architecture doc)
- Automated text moderation (profanity/harassment classifier) before a message can enter Infinity World or be sent to a friend
- Voice notes: basic audio-length/format validation at minimum for MVP; flag for manual review if reported (full audio moderation is a fast-follow, not MVP-blocking)
- Report flow on any received/public message
- Block user (removes friendship, prevents future friend requests/messages)
- Rate limiting on sends (prevent spam-flooding Infinity World)
- Lightweight keyword check on flagged emotional content → surfaces a non-intrusive "need someone to talk to?" resource card (never blocks sending, never reads/stores the flag against the user)

---

## 6. Non-Goals (v1)

- Real-time chat / typing indicators
- Public comments, likes, follower counts
- Monetization (defer — see §9)
- Web app (mobile-only for v1; Expo makes a future web build possible but out of scope)
- User-generated custom characters/palace assets (curated only, for art-quality control)
- Multiplayer real-time animation (the delivery walk is simulated, not synced)

---

## 7. Success Metrics (suggested — replace with your own)

- D1/D7 retention of users who complete onboarding + send 1 letter
- % of users who add at least 1 friend within 7 days
- Average time-to-first-send (onboarding friction proxy)
- Report rate per 1,000 Infinity World messages (safety health)
- Crash-free session rate, app size (KB), cold start time (technical health)

---

## 8. Open Questions (need your decision before build)

1. Should "Sign it" (reveal username) be the default, or off-by-default? (PRD assumes **off by default**.)
2. Voice notes in Infinity World — playable by anyone, or text-only for public and voice reserved for friends? (PRD assumes **both allowed**, flag if you want to restrict.)
3. Should burned messages be 100% unrecoverable to the user (no "undo"), given how final that is? (PRD assumes **yes, with a confirmation step before burning**.)
4. Age gating / minimum age for account creation (recommend 13+ with standard app-store requirements; you'll need a ToS/Privacy Policy regardless).
5. Content retention/legal: do you want a formal Terms of Service and moderation escalation policy before public launch? (Strongly recommended given public anonymous-ish content.)

---

## 9. Future / Post-MVP Ideas

- Palace decoration/customization economy (cosmetic only)
- Seasonal/limited presets (events, holidays)
- "Echoes" — sender can optionally allow one Infinity World message to be "found" and replied to anonymously once
- Memory Garden — sender's own private archive of everything they've sent (opt-in, since Burning World is intentionally non-archived)
- Web companion (Expo web build) for writing on desktop
