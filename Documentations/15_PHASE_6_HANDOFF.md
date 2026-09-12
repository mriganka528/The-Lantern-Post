# Phase 6 — letters between friendship gates

The user wants to finish the in-app product first. **Android APK builds, live phone push and the live moderation service are deferred by request.** This pass implements private text-letter delivery, its recovery rules, the palace letterbox/reader, and a clearly labelled journey preview. It does not activate an external service or start a device build.

Actual sending remains gated on moderation approval. The default production provider is deliberately unavailable. Isolated test providers verify the complete delivery path; the preview lets the user review the journey without sending or changing a draft.

## Experience

- Seal a letter and choose **Send to a friend's gate** or the existing Burning World path. The friend picker contains only accepted friendships and names the recipient on the final send button.
- **Preview the journey** keeps the sealed draft intact and makes no send request. Its heading and caption explicitly identify it as a preview.
- After confirmed delivery and local cleanup, the courier takes a continuous **6.8-second walk** across the river to the selected palace. Its doors reveal the recipient's companion, then the envelope is placed inside. The scene preserves live water, waterfalls, queens and angels. It waits for its world to mount, respects reduced motion, and has a skip/return action.
- The palace links to **Letters at your gate**, with an unopened count. Received and sent envelopes page in groups of 24; list responses contain no words.
- **Break the seal** fetches the letter only after server authorisation. The recipient's first opening marks it read. The sender is not shown read receipts. The reader preserves the original antique stationery snapshot, readable/selectable ink, crest and engraved paper edges.
- **Write to…** from a friendship gate and **Write back…** from a letter open the desk with the friend preselected. Existing drafts are preserved; these actions never send automatically.
- Either participant can confirm removal from both palaces. The text and stationery snapshot are cleared immediately; the delivery receipt prevents a replay from restoring them.

## Moderation and permissions

`LetterModerationService` is the boundary for a later real provider. Its default returns a safe `503 MODERATION_UNAVAILABLE`; it never approves a letter. There is no production allow-all flag or test bypass route. The picker disables actual sending when the provider is unavailable while retaining preview.

The server checks recipient friendship, blocks, stationery and limits before moderation, then rechecks them in the final transaction after approval. Text is never persisted before approval. Flagged letters produce only a content-free rejection receipt and remain on the sender's device for revision. Provider failures are sanitised and leave delivery unconfirmed.

Reading, listing, counting and deleting require participation and **current mutual friendship**, with blocks in both directions. Burned, deleted, non-friend and unapproved records are excluded. Reader text stays in component-local memory, with requests cancelled on exit; it is not placed into the shared query cache or another local draft. Burning World content retention is unchanged.

## Recovery and persistence

Draft format **version 3** adds `delivery-pending`/`delivered`, a bounded recipient snapshot and a delivery receipt. Versions 1 and 2 migrate without losing words, stationery, seal state or an existing burn. The per-owner storage key stays the same.

The pending intent and recipient must be saved before transmission. Pending pages cannot be edited, retargeted, burned or reset. A lost reply is recovered by receipt lookup. Confirmed delivery clears local words before the journey plays; a cleanup failure keeps the persisted pending fence and offers a retry. Old windows or delayed replies cannot overwrite a new page or another account.

An uncertain delivery can be **durably cancelled**. A saved `REJECTED/CANCELLED` receipt prevents later approval from sending it. If delivery already won, cancellation returns its delivered receipt instead. Only a durable rejection/cancellation unlocks editing; a later attempt uses a fresh UUID.

Serializable transactions and unique owner/request receipts handle duplicates and races. A delivered letter, receipt and notification event commit together. Failure rolls back the content write. Receipts contain no text or text hash. The daily limit of 50 successful friend deliveries uses durable receipts, so content deletion/purging cannot reset it.

## API

Every route uses the verified Clerk identity and `Cache-Control: no-store`. Destination-specific DTOs reject extra identity, moderation, public-world, voice and URL fields.

| Endpoint | Behaviour |
| --- | --- |
| `POST /letters` | Confirmed `TEXT` to `BURNING` or `FRIEND`; friend delivery requires recipient, `deliveryConfirmed: true`, UUID v4, preset and 1–2,000 Unicode code points |
| `GET /letters/friends/capabilities` | Live moderation availability; currently false |
| `GET /letters/friends/requests/:requestId` | The sender's receipt or null, without words |
| `POST /letters/friends/requests/:requestId/cancel` | `{ "recipientId": "…" }`; durable cancellation or the winning delivered receipt |
| `GET /letters/friends?box=received` | Received/sent envelope metadata; supports `cursor` |
| `GET /letters/friends/summary` | Owner's unread/received/sent counts |
| `POST /letters/friends/:id/open` | Authorised reading; marks first recipient opening |
| `POST /letters/friends/:id/delete` | Clears the letter from both palaces; receipt remains |

There is no general read/recovery endpoint for burned letters. `INFINITY` and `VOICE` submissions are not enabled in this phase.

## Schema and startup

Migration **`20260913010000_friend_letter_delivery`** adds `DeliveryReceipt`, stationery snapshots, recipient read timestamps, a private-delivery integrity constraint, and letter references in the notification outbox. Existing valid data is preserved. Manually inserted delivered friend rows lacking approval/snapshot fields stop the migration rather than silently becoming readable.

Schema validation passes. The migration was not applied by the agent. Generation wrote updated Prisma client/types but Windows refused replacing the engine DLL while the API held it open. The installed engine was checked and matches Prisma's expected engine. Stop the API before applying the database update:

```powershell
# From the workspace root
npm.cmd run db:generate
npm.cmd run db:deploy
npm.cmd run db:status
npm.cmd run dev:server
```

In the preview terminal, use `npm.cmd run dev:web -- --clear`. No new package or credential is required for this development pass. Do not make Android/FCM setup a prerequisite for subsequent in-app features.

## Deferred notification wiring

The outbox supports `LETTER_DELIVERED` alongside friend invitations. Its generic notices and routing IDs contain no letter text or friend's name. The worker checks recipient ownership, current friendship/blocking, approval, deletion and whether the letter was already opened. Native taps route only the matching owner to `/inbox`; the native adapter and its setup template remain in sync.

Live device delivery is still off/unverified. The retained `14_ANDROID_NOTIFICATIONS_SETUP.md` applies when the user resumes that work.

## Verification

- **141 tests pass:** 55 client and 86 API tests. Coverage includes moderation-before-persistence, malformed inputs, current authorisation, duplicate/cancel races, rollback, cleanup failure, private reading/deletion, stationery snapshots, pagination/limits and legacy drafts.
- Workspace lint/type checks, API build and Prisma schema validation pass. Web/iOS/Android JavaScript bundle exports pass; these are not APK builds.
- `scripts/check-phase6-ui.mjs` exercises actual UI and Nest endpoints with isolated identities, in-memory persistence and a controlled moderator. It checks zero-send preview, continuous courier motion, confirmation before animation, draft cleanup, reading/deletion, reload after lost replies, cancellation, account isolation and phone/reduced-motion layout. Screenshots are in `.cache/phase6-review`.
- Phase 4 and 5 browser regressions also pass, preserving the burn/recovery controls, zoom/touch behaviour, antique desk, invitations and friendship gates.
- `server/scripts/check-private-letters-database.mjs` adds PostgreSQL race/integrity tests to CI. It requires an explicit local database in `PRIVATE_LETTERS_TEST_DATABASE_URL`, uses synthetic records and cleans up only those records. It never reads `server/.env`. No local PostgreSQL runtime is available, so this script has not run locally.
- Live database execution, a real moderator, physical-device operation and push delivery remain unverified. No APK or EAS build was started.

The next planned in-app feature is Phase 7: voice notes, with bounded recording/playback, storage/upload wiring and the same private-delivery boundaries. APK/store work remains deferred.
