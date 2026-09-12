# Phase 2 — Character selection and the palace

User update: the user confirmed the app is working and authorised Phase 3 plus a walking arrival and majestic scenery. See [the Phase 3 handoff](11_PHASE_3_HANDOFF.md) for current status. The Phase 2 notes below retain their original verification history.

The user confirmed Phase 1 is working and authorised Phase 2 on 2026-09-12. The new source implements six companions, saved character selection, matching static palaces, and an opening-door entrance. The enduring visual direction is recorded in [09_ART_DIRECTION.md](09_ART_DIRECTION.md) and the root `AGENTS.md`.

## Run the update

The six Character records are seeded by the additive migration `20260912010000_seed_characters`. The existing Prisma schema already has the required relations and fields; no schema alteration or account reset is needed.

From the repository root:

```powershell
npm.cmd run db:status
npm.cmd run db:deploy
npm.cmd run db:status
npm.cmd run dev:server
```

In a second terminal:

```powershell
npm.cmd run dev:web -- --clear
```

Open http://localhost:8081. An existing account with a username but no companion will enter the gallery. Choose a companion, confirm with **Begin with…**, and open or skip the palace doors. Subsequent profile loads use the saved selection. **Companions** lets the user change it; the selected character and matching theme are saved together.

No new runtime dependency or environment variable is required. Existing Clerk/Neon credentials are preserved.

## API and data behaviour

All new endpoints require the existing verified Clerk session:

| Endpoint | Response / behaviour |
| --- | --- |
| `GET /characters` | The active, supported curated catalog in its intended order |
| `POST /users/me/character` | Accepts only `{ "characterId": "..." }`; returns the updated owner profile |
| `GET /users/me/palace` | Returns the saved companion with palace metadata, or null before selection |

The backend derives identity from the session and palace theme from curated metadata. Unknown/inactive selections fail without updating the user. A username must already exist. Saving uses a transaction and an atomic update of the character/theme pair; repeating a selection is safe. Concurrent changes use the last successful update, always preserving a matching pair. Retiring a companion removes it from the gallery while preserving its existing owners' palace.

Responses serialize explicit public fields, excluding provider identity and private database fields. Seed conflicts on an existing character key preserve its original ID and activation setting. The seed adds/updates only the six curated Character records; it does not assign characters to users.

The app scopes queries and pending work to the existing authenticated session. Selection cancels stale profile/palace reads before updating the cache. Palace queries include the saved character ID. Failures leave retry/account controls available, and the entrance runs only after a successful save.

## Visuals and scope

- Six original illustrated companions and corresponding static cloud palaces.
- Responsive gallery, live palace preview, personalised home, account dialog, and companion switching.
- Ornate doors opening on their hinges, a companion reveal, and a soft transition into the palace.
- Entrance skip/replay, reduced-motion support, and an ambient-motion toggle.
- Coordinated parchment, gold, serif typography, and ornaments on auth/loading screens.
- Bundled images on all platforms; editable vector sources are retained.

Writing-desk and destination descriptions are labelled **Coming soon**. Phase 3 will implement the text composer, preset choice, and sealing. Letter delivery, friends, voice, decoration, and public-world features remain in their scheduled phases.

## Verification and limits

The API/client suite passes **58 tests**. Workspace type checks, lint, Prisma schema validation, and the API build pass. Web, Android, and iOS production bundle exports pass using public fixture settings and no live Clerk/Neon connection. New tests exercise auth requirements, explicit serialization, active catalog filtering, identity/theme injection rejection, profile prerequisites, safe retries, owner isolation, character switching, retirement, failure handling, and pair consistency under concurrent requests. Database operations use controlled providers in these tests.

The local browser fixture exercises the actual presentation components with synthetic characters and local storage. It checks all six choices, arrow-key selection, their palaces, entrance animation, skip/replay, reduced motion, the ambient-motion toggle, phone layout, and account dialog dismissal. It is created outside Expo Router and removed after the run; no auth bypass or preview route ships in the application. This fixture does not prove Clerk login or live database persistence.

Screenshots are saved in `.cache/phase2-review`. Run `npm.cmd test` first, start Metro on port 8082, then use `node scripts/check-phase2-ui.mjs` with a local Playwright installation to repeat that check.

**Live Neon seeding is pending.** The sandboxed migration status command failed to reach a usable schema-engine result. Automatic approval review rejected the network-enabled check because its approval service returned a 404 deployment error. The agent did not apply the new migration or modify live account data. Apply the commands above in a terminal with database access before using character selection.

After applying the seed, verify in the real app: select a companion, reload or restart, sign out/in, change companions, and switch between two accounts. Confirm each account returns to its own palace. Test the door animation and accessibility setting on an actual Android/iOS device; bundle exports verify compilation, not device operation.
