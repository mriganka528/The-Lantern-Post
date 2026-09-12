# Phase 3 — Writing desk, stationery, and sealing

The user advanced to Phase 4 and requested an older palace style for the letter section and presets. See [the Phase 4 handoff](12_PHASE_4_HANDOFF.md) for current behaviour and setup. The notes below preserve the Phase 3 implementation history.

The user confirmed the app is working and authorised Phase 3, plus a walking arrival and a more majestic palace background. The source implements the text compose flow and those visual improvements. Live application of the new stationery seed is still pending.

## Start the update

From the repository root, apply the additive stationery migration and restart the API:

```powershell
npm.cmd run db:status
npm.cmd run db:deploy
npm.cmd run dev:server
```

In another terminal:

```powershell
npm.cmd run dev:web -- --clear
```

For Expo Go, use `npm.cmd start -- --clear`. The app is in `client/`; plain `npx expo start` in the repository root deliberately prints the correct commands.

`expo-file-system` is now declared directly at the already-installed SDK-compatible `~57.0.7` version. Its existing lockfile entry is reused, with no version change or new package download. A fresh checkout should use `npm.cmd ci`. No new keys, external art service, or native development build are required by this change.

## What the user can do

Open **The writing desk** from the palace. Write up to 2,000 Unicode code points, choose stationery, and press **Seal my letter**. Empty/whitespace-only and over-limit text cannot be sealed. Over-limit pasted text remains editable, with a counter and an error, rather than being silently shortened to 2,000 characters.

The six seeded styles are Lantern parchment, Moonflower, Rose & ribbon, Celestial vellum, Meadow linen, and Royal ivory. Paper colour, ink, wax, ribbon, texture, motif, and typography come from preset data.

Sealing stores the draft successfully before showing the folding/flap/wax animation. A sealed envelope can be reopened and edited, or left while returning to the palace. This phase does not send a letter, choose a destination, or create a server Letter row. Phase 4 will add the Burning World send flow.

After opening the palace gate, the selected companion walks across the bridge to the palace, with separate moving feet, body motion, distance scaling, and a turn at the steps. Gate and walk can both be skipped. The scene includes animated river highlights, twin waterfalls, two royal terrace figures, and two hovering angels. The background-motion control pauses ambient animation, and the system reduced-motion setting skips entrance/sealing motion.

## Persistence and API

`GET /presets` uses the existing Clerk guard. It selects active presets and explicitly serializes only supported version-1 stationery config. Unknown formats and invalid colour/motif/font values are excluded. It accepts no letter text. The additive `20260912020000_seed_stationery` migration adds or updates the six curated records, preserving existing IDs and activation/seasonal settings. No schema change or user data reset is required.

Drafts are local to the current app/browser installation, keyed by the authenticated profile ID. Native uses Expo FileSystem in the app's document directory; browser uses localStorage. Small synchronous writes finish in order as edits occur. Native writes a replacement file before moving it over the last saved file. Nothing in the compose flow uploads the text or exposes it in a URL, query cache, or log.

The draft includes its stationery snapshot, so a saved letter remains editable if the preset catalog is temporarily unavailable. A future send endpoint must validate the current preset ID/availability before delivery. This phase's offline stationery snapshot is not server authorization.

Restoration validates the version, owner, content, state, timestamps, and stationery. Unreadable/corrupt data produces a recovery screen. Starting a fresh page requires an explicit confirmation. Failed writes preserve the current editor content, show **Not saved yet**, and offer retry. Failed sealing stays in the editor, and a failed reset preserves the previous draft. Clearing browser storage or uninstalling the app can remove drafts; this is not cross-device sync or a cloud backup feature.

## Verification

The suite passes **70 tests** (25 client, 45 API), covering existing auth/character behaviour plus draft restore, Unicode limits, owner isolation, local storage failures, sealing/reopening, malformed draft data, preset authorization, supported config filtering, and safe error responses. API database tests use controlled providers.

`scripts/check-phase3-ui.mjs` compiles an isolated browser fixture with the real presentation components and real browser localStorage. It runs through a local `file://` page, with network requests blocked. It checks walking position/scale/steps, waterfall motion and pause, six stationery styles, restore after reload, owner changes, over-limit handling, sealing/reopening, unavailable-catalog editing, phone layout, and reduced motion. It uses synthetic users and does not bypass production auth or register an Expo route. Screenshots and the review page are written to `.cache/phase3-review`.

Run `npm.cmd test` before `node scripts/check-phase3-ui.mjs`, because the review fixture reads compiled serializers and the checked-in seed data. The review script uses the existing local Webpack/TypeScript packages and Playwright (optionally installed in `.cache/art-tools`). It pins its fixture's React resolution to `client/` to match the app. This offline fixture does not prove a live Clerk session or native operation.

Workspace type checks, lint, API build, Prisma schema validation, and web/Android/iOS production bundle exports all pass. Expo's offline dependency compatibility check also passes against its bundled SDK metadata. Native exports verify bundling, not phone behaviour. Check keyboard handling, file persistence after force-close, and animation performance on an actual device before release.

## Outstanding environment step

The sandboxed Neon migration check failed. Automatic approval review rejected the network-enabled check, and also a local preview-server startup, because its approval service returned a 404 deployment error. The agent completed browser checks through an offline build but did not apply the stationery migration to live Neon. Run `npm.cmd run db:deploy` in a terminal with database access before opening the writing desk for the first time.

After applying the seed, verify through real sign-in: open the desk, write, change stationery, reload, seal, reopen, and switch accounts. Verify the new walking arrival and the motion preference on web and a native device. No letter delivery is enabled yet.
