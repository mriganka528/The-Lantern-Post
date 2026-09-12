# Phase 4 — Burning World and antique stationery

Phase 5 is now recorded in [the friendship court handoff](./13_PHASE_5_HANDOFF.md). This document retains the Phase 4 implementation and setup history.

The user authorised Phase 4 and asked for a stronger old-palace look in the letter section and presets. The implementation adds the confirmed Burning World send loop, a palace scriptorium, and aged manuscript stationery. The latest refinement replaces the small hearth with a majestic, explorable fire kingdom and a slower progressive paper burn. Phase 4 live migrations were not applied by the agent in this environment; the visual refinement adds no database change.

## Run the update

If Phase 4 is already running, refresh the app or restart Metro with `npm.cmd run dev:web -- --clear`; the realm refinement needs no new dependency, credential, or migration. The following setup is only needed if the original Phase 4 receipt/stationery migrations have not been applied. Stop the API with **Ctrl+C** before regenerating Prisma. From the repository root:

```powershell
npm.cmd run db:generate
npm.cmd run db:status
npm.cmd run db:deploy
npm.cmd run dev:server
```

In the web-preview terminal, restart with:

```powershell
npm.cmd run dev:web -- --clear
```

`20260912030000_burn_receipts` adds the content-free release ledger. `20260912040000_antique_stationery` updates colours/descriptions on the six existing presets without changing their IDs or activation settings. No existing letters or users are reset. Existing Phase 3 drafts migrate locally when loaded/edited.

Prisma generation wrote the new JavaScript/types, but could not replace the Windows query-engine DLL (`EPERM`). The existing DLL was verified to match the installed Prisma 6.19.3 engine, and the generated client exposes the new receipt delegate. Repeat `db:generate` with the API stopped to complete the command cleanly; do not use `--no-engine`, which changes Prisma's runtime mode.

There is no new runtime dependency or credential. The Lottie download was rejected by automatic approval review because the approval service returned a 404 deployment error. The completed burn animation uses the existing React Native Animated system and bundled artwork.

## User flow

1. Write and seal a letter, then choose **Let it go to the fire**.
2. Review the Burning World and its explicit **This can’t be undone** notice. **Keep my letter** returns without a request or data loss.
3. **Burn this letter** records the local intent before submitting it. The letter remains sealed while a response is uncertain.
4. After a confirmed `BURNED` result, the text is removed locally before the burn animation plays. The scene scrolls into view. The letter descends, chars progressively from an uneven glowing edge, loses its wax seal, and becomes drifting ash and embers over eleven seconds.
5. The finished scene remains open, with settled ash visible in the brazier. **Return to my palace** finishes with a fresh empty draft. The animation can be skipped; reduced motion goes straight to this quiet completion.

An offline or lost reply offers retry/status checking, not a false success. If the API rejects unavailable stationery, that rejection is durable and the sealed letter is kept for editing. A local cleanup failure hides the words, blocks completion, and offers a cleanup retry. Returning home while a request is pending preserves the same request for later resolution.

The letter UI now has a carved wood surface, candlelit palace chamber, weathered paper silhouette, fibres and fold marks, four engraved border motifs, royal crests, ribbons, and detailed wax seals. The six preset cards show miniature manuscripts. Text remains readable above the decorative paper layers. The full bundled artwork set, including the refined realm, is 68 PNGs, about 9.9 MB; editable sources and SVG outputs remain in the repository.

## Burning World refinement

- A 1600 × 1000 celestial kingdom with floating temples, golden waterfalls, constellations, an ancient bronze altar, and Aureon, an original crowned fire guardian. Layered flame artwork, light, and drifting motes keep the environment alive.
- Zoom from **100–300%**, drag to pan, pinch on touchscreens, or use the zoom/reset buttons. **The guardian** and **The letter** focus the camera. Web supports Ctrl/trackpad scroll, a wheel while the scene is focused, `+`/`−`, arrows, and `0`/Home to reset. Normal unfocused scrolling remains page scrolling.
- Thirty independently clipped paper strips recede along a charred edge; the sheet keeps its size instead of shrinking away. Forty-two flecks drift from the burn with warm embers among the ash. The engraving is decorative and never retains the user's text.
- Ambient fire has a pause switch and stops for reduced motion, backgrounding, and unmount. The letter's burn begins only after acceptance and successful local cleanup. Camera controls do not submit a letter or change its release state.
- Implementation is in `burning-realm.tsx`, `progressive-burn-letter.tsx`, `zoomable-realm.tsx`, and the shared `realm-camera.ts` with separate native/web viewport adapters. Artwork comes from `client/artwork-source/ember-realm-art.tsx`. There are no new runtime dependencies or backend changes.

## API and persistence

| Endpoint | Behaviour |
| --- | --- |
| `POST /letters` | Accepts only confirmed `TEXT` letters for `BURNING`, up to 2,000 Unicode code points, with a UUID v4 request ID and preset ID |
| `GET /letters/burning/requests/:requestId` | Returns only the signed-in owner's release outcome, or null while it is unknown |

Both endpoints use the existing Clerk guard and `Cache-Control: no-store`. Client-supplied sender/recipient identities, signing flags, voice fields, and other destinations are rejected. There is no general letter-read endpoint or recovery endpoint.

The backend validates text in memory and **never writes that text or a text digest to the database**. In one transaction, it writes a `HARD_DELETED` Letter audit stub with null text/audio/recipient fields and a `BURNED` receipt. Invalid/inactive stationery instead produces a `REJECTED` receipt with no Letter row. The user and selected companion must exist.

Receipt IDs are derived from the verified owner's database ID and the request UUID, not from the content. Duplicate requests, including concurrent ones, return the winning transaction's result. A durable rejection prevents a delayed duplicate from burning a letter after the client has been told it can edit again. The client freezes and persists the request before sending, and never reuses its UUID for a different release. No body hash is retained.

This implements the Phase 4 plan's no-retained-content path. The older PRD's optional 30-day content-retention idea is not activated. Only minimal audit/receipt metadata is retained; moderation is not needed for this private, non-delivered content. Any future content-retention policy needs an explicit product decision before activation. Later letter readers must continue excluding deleted Burning World records. Keep receipt history available for the supported retry period even if already-empty Letter audit stubs are removed.

Local format version 2 adds a page generation ID and `burn-pending`/`burned` states while retaining the existing per-owner storage key. Old version-1 drafts preserve their words and stationery. Before transmission, the pending state acts as a persisted lock. On restart, it can check/retry its receipt but cannot reopen the words. After acceptance, memory is cleared immediately; completion waits for the local write to succeed. Each mutation checks for external changes, browser storage events refresh other open editors, and stale pages cannot overwrite a pending/burned or newer page. A late response for another generation/account cannot erase its content.

## Verification

- **94 tests pass**: 41 client and 53 API tests, including camera bounds/anchoring, pinch transitions, viewport resizing, auth/validation, no-content persistence, duplicate requests, rollback, owner isolation, durable rejection, lost acknowledgements, local cleanup failures, stale editors, and legacy draft migration.
- The realm refinement passes client type checks/lint and web/Android/iOS production bundle exports. Original Phase 4 verification also covered workspace checks, the API build, and Prisma schema validation; the refinement does not change the API or schema.
- `scripts/check-phase4-ui.mjs` exercises the actual UI and browser local storage through a local file page. Its receipt transport is a controlled fixture, not a live Clerk/Neon service. It checks all six antique presets, cancellation, pre-send storage failure, acknowledgement-before-animation, content clearing, account switching during a request, reload recovery, rejection, cleanup retry, and skipping. Realm checks include zoom bounds, focus/reset, drag, keyboard, wheel and simulated two-finger touch, ambient pause, progressive paper erosion, visible ash/flames, lingering completion, phone layout/automatic scroll, and reduced motion.
- Visual review and screenshots are in `.cache/phase4-review`. Run `npm.cmd test`, then `node scripts/check-phase4-ui.mjs` with the existing local Playwright/Webpack tooling. The fixture is outside Expo Router and is not included in the app.
- `server/scripts/check-burn-database.mjs` adds real PostgreSQL concurrency/constraint checks to CI after migrations and the API build. It requires an explicit **local test database** in `BURN_TEST_DATABASE_URL`, creates isolated synthetic records, and cleans up only those records. It never loads `server/.env`. This database integration check could not run locally because no local PostgreSQL runtime was available.

## Remaining environment checks

During original Phase 4 setup, the sandboxed Neon migration check failed, and automatic approval review rejected the network-enabled check because its approval service returned 404. Neither migration was applied by the agent. If they have since been applied and burning works, no further database action is needed for this visual refinement. API/unit tests use controlled providers; the offline browser test uses a controlled receipt transport. Those checks do not prove live Neon execution.

After setup, test a synthetic letter through real sign-in: cancel once, release it, return to the palace, reopen the desk, and confirm the old words are absent. Check device file persistence, keyboard layout, interruption/retry, pinch/pan and animation performance on a physical phone. Browser touch simulation and exports do not establish native device performance.

Phase 5 is Friends: username search, friend requests, and a friends list. No friend delivery, public-world sending, voice, or social endpoints are enabled in this phase.
