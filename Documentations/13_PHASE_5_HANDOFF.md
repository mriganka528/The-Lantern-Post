# Phase 5 — the friendship court

The current development pass is recorded in [Phase 6 — letters between friendship gates](./15_PHASE_6_HANDOFF.md). This document retains the Phase 5 history.

The user has deferred Android APK builds and live phone-push configuration until the in-app product is built. Continue product development in the browser; keep the prepared native setup for later.

The user authorised the next phase after the Burning World refinement. The friends flow is implemented: username search, invitations, accept/decline, mutual friend lists, and friendship gates in the palace. The server notification outbox is implemented and tested. The user has now installed the Expo push packages and activated the native adapter; it passes type checks and all three platform exports. **Real phone delivery still needs the Expo/Firebase project setup and an Android development APK.** Live database setup remains unverified here. No friend letter delivery is enabled yet; that is Phase 6.

## Run the friends update

Stop the API with **Ctrl+C**, then run from the repository root:

```powershell
npm.cmd run db:generate
npm.cmd run db:deploy
npm.cmd run db:status
npm.cmd run dev:server
```

In the Expo terminal:

```powershell
npm.cmd run dev:web -- --clear
# Or Expo Go:
npm.cmd start -- --clear
```

The new migration is `20260912050000_friends_and_notifications`. It adds the notification outbox, lookup indexes, a no-self-request constraint, and uniqueness for an unordered pair of users. It preserves existing users, letters, companions, and requests. If someone manually inserted reverse duplicate requests, the migration fails rather than silently deleting either row; inspect those records before reconciling them.

`db:validate` passed. The live Neon migration-status check failed with a schema-engine error in the sandbox; the agent did not apply the migration. Prisma generation wrote the updated JavaScript/types but again hit `EPERM` replacing the Windows engine DLL while the API was running. The existing DLL matches the installed Prisma engine exactly. Regenerate with the API stopped; do not use `--no-engine`.

## The user experience

Open **The friendship court** from the palace. Search by a username (an initial `@` is accepted in the UI), then send an invitation. The court has three guestbook tabs: **Friendship gates**, **At my gate**, and **Sent invitations**. Counts refresh while the app is active, and returning to the screen refreshes its data.

Only the recipient can welcome or decline a request. Acceptance opens a pair of ornamental doors onto the friend's palace after the API confirms the friendship. The reveal lasts about 1.25 seconds, can be dismissed immediately, and opens without motion when reduced motion is enabled. Accepted friends appear as small brass-and-wood gates with their companions; the palace shows up to four, and the full guestbook pages through the rest.

The court uses a new bundled illustration with sage gates, climbing roses, pearl clouds, angels, aged stone, and a royal guestbook plaque. Existing palace arrival, flowing water, queens/angels, antique stationery, and the zoomable fire kingdom are preserved. The full curated set is 69 PNGs, about 10.2 MB, with editable SVG/TypeScript sources.

Search waits for **Find their palace**, requires 3–24 letters/numbers/underscores, normalises case, and returns up to 20 matches. Changing the search hides its previous results. It excludes the current user, accounts without a companion, and blocked accounts. Long lists use opaque cursors, 24 entries per page, with a **Turn another page** control.

An uncertain reply offers a refresh/retry path. Retries reuse the existing invitation. Crossed requests return the same pending invitation and still require its recipient to accept. Declining creates no friendship or acceptance notice. A declined pair can try again after 24 hours; a new request ID prevents an old tab from answering the later invitation. A basic limit permits 20 new invitations per user in 24 hours; retries and accepting received invitations do not consume that limit.

## API and persistence

All routes use the existing Clerk session guard and `Cache-Control: no-store`. The server derives the actor from the verified session. Extra identity/status fields are rejected. Public social cards include only ID, username, and the curated companion/palace description; no provider identity, email, private profile, or push token is returned.

| Endpoint | Request / behaviour |
| --- | --- |
| `GET /friends/search?username=moon` | Username-prefix search with relationship state |
| `GET /friends?view=friends` | Mutual friendships; also supports `incoming`, `outgoing`, and `cursor` |
| `GET /friends/summary` | The owner's friend/incoming/outgoing counts |
| `POST /friends/requests` | `{ "username": "moon_flower" }`; retry-safe send |
| `POST /friends/requests/:id/respond` | `{ "action": "accept" }` or `decline`; recipient only |
| `GET /notifications/settings` | Whether server push registration is enabled |
| `POST /notifications/register` | `{ "token": "ExpoPushToken[...]", "platform": "ios" }` or Android |
| `POST /notifications/unregister` | `{ "token": "ExpoPushToken[...]" }`; scoped to the owner |

Friendship remains an `ACCEPTED` `FriendRequest`, as specified in the original data model. Serializable transactions, bounded retries, and the unordered-pair database index handle concurrent and reverse requests. State changes and notification enqueue commit together. Blocks in either direction are checked on search, list, response, and dispatch. The block-management UI/endpoints remain in their planned later phase.

The outbox contains request IDs, recipient IDs, event kind and delivery bookkeeping only. A 30-second worker claims jobs, skips stale/declined/blocked events, sends generic invitation/acceptance alerts through Expo, retires tokens rejected as unregistered, and backs off on provider failure. Jobs expire after a day and stop after eight attempts. Expo ticket acknowledgement completes a job; actual device delivery and later Expo delivery receipts have not been verified here. Retries are at least once, so a rare duplicate notice is possible; the prepared client adapter deduplicates tap events. Push failures never undo a friendship.

Installation tokens belong to the currently registered account; a late unregister is restricted to the prior owner and cannot remove a newer registration. Sign-out attempts unregister before ending the session. Notification text contains no friend's name or letter text, and taps are accepted only for the current owner's friendship screen. Disabling alerts or signing out cannot recall a notification already queued by the OS/provider.

## Native push — packages installed; Android build setup next

The user completed the approved installation and ran `setup:push`. `expo-notifications` **57.0.18** and `expo-device` **57.0.2** are installed and recorded in the lockfile. `push-driver.native.ts` and the Expo Notifications plugin are active in source; the native adapter compiles against the installed SDK. Web keeps the portable adapter, and Expo Go intentionally leaves remote alerts unavailable. `EXPO_PUSH_ENABLED` still defaults to `false` on the server.

Earlier agent attempts were blocked by network `EACCES` and the approval service's **404 deployment error**. The user explicitly approved the installation on **2026-09-13** and subsequently completed it in their terminal. That installation blocker is resolved; do not ask for the same permission or repeat the package-install step.

The user selected an **Android phone** for testing. The next steps are in [Android phone notifications setup](./14_ANDROID_NOTIFICATIONS_SETUP.md): install `expo-dev-client`, link the Expo project, register `com.lanternpost.app` in Firebase, provide the matching Android configuration and FCM V1 credential, and build the development APK. `client/eas.json` and the Android package/Firebase path are prepared. The Firebase file is not present yet; no credential, project UUID, or account was invented.

For reference, the completed package/adapter setup used these commands; they do not need repeating:

```powershell
npm.cmd install expo-notifications@~57.0.18 expo-device@~57.0.2 --workspace @lantern-post/mobile
npm.cmd run setup:push
npm.cmd run typecheck
npm.cmd run lint
```

`setup:push` checks both installed package versions before writing anything, copies the native adapter, and adds the Expo Notifications config plugin. It does not download dependencies, create an Expo account, modify private environment files, or build/publish an app. Web retains the portable adapter. The native adapter loads Notifications only on a supported device/build, requests permission only when the user enables alerts, creates the Android channel, registers an Expo token, and routes owned notification taps to the court.

Link a real Expo project using `eas init` from `client/`; the adapter reads `expo.extra.eas.projectId` automatically. `EXPO_PUBLIC_EAS_PROJECT_ID` in `client/.env` is an alternative. Android is configured locally as `com.lanternpost.app`; its Firebase registration must match. Configure FCM V1 credentials and produce the Android development build. Remote push is not supported by this app in Expo Go or web. On the server set `EXPO_PUSH_ENABLED=true` once ready; if Expo enhanced push security is enabled, its `EXPO_ACCESS_TOKEN` belongs only in `server/.env`. No signing credential or server secret belongs in the client.

Then enable **The palace bells** on a physical device and verify both received-invitation and accepted-invitation pushes, tap routing, token refresh, denied permission, sign-out, and account switching. These setup/physical-device checks are still needed before calling Phase 5's push deliverable complete.

## Verification

- **115 tests pass:** 45 client and 70 API tests. New coverage includes public search cards, blocked-account filtering, pagination, sender/recipient authorisation, duplicate/crossed requests, transaction rollback, cooldown/stale responses, limits, token ownership, both notification kinds, unavailable push, provider failures and device-token retirement.
- Workspace lint/type checks, API build, and Prisma schema validation pass.
- After the user's installation, client lint/type checks, all 115 tests, and web/iOS/Android bundle exports pass with the real native notification adapter included on native platforms. The prepared EAS development profile and archive exclusions also validate. This does not establish delivery to a physical phone.
- The earlier Phase 4 browser regression also passes, including the antique desk, confirmed burn/recovery, zoom, ash, skip, and reduced-motion behaviour.
- `scripts/check-phase5-ui.mjs` runs real client components against the real Nest friends endpoints using isolated test identities and an in-memory Prisma provider. It covers send/accept/decline with two accounts, failures and lost acknowledgements, reload, account changes, no gate reveal before acceptance, reduced motion, phone layout, and palace friend gates. Screenshots are in `.cache/phase5-review`.
- `server/scripts/check-friends-database.mjs` adds real PostgreSQL race/constraint checks to CI after migrations. It accepts only an explicit local test database in `FRIENDS_TEST_DATABASE_URL`, uses synthetic records, and cleans up only those records. It never reads `server/.env`. There is no local PostgreSQL runtime here, so this integration script has not run locally.
- Live Clerk/Neon friendship, native gestures/performance, and push delivery remain unverified. Test with two signed-in accounts after applying the migration: invite, accept, confirm each account sees the other's gate, then exercise decline and refresh.

Phase 6 is private letter delivery to a friend's gate. It must enforce mutual friendship/blocking and moderation on the server before any letter is delivered or read. The Burning World still accepts only `BURNING`; no `FRIEND` sending is enabled by this phase.
