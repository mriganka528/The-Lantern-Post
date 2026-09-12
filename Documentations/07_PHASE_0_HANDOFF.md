# Phase 0 handoff

Layout update: the requested simpler structure now uses `client/` and `server/`. Database/API settings are consolidated in `server/.env`; the former root `.env` and `apps/` paths in the historical notes below are obsolete. See the root README for web preview and startup commands.

Current update: the user selected Neon and supplied the database URL in the root `.env`. Docker is now optional. Dependencies are installed, Prisma generation/schema validation pass, and full local type/lint/API tests run. Live Neon inspection/migrations are blocked by this session's network approval service. See the Phase 1 handoff and root README for the current setup; the notes below record the original Phase 0 handoff.

Status: foundation files prepared; installation and runtime verification are pending.

## Prepared

- npm workspace structure with a TypeScript Expo Router app, NestJS REST API, and shared public types.
- Local PostgreSQL 17 Docker Compose service, persistent volume, and local environment examples.
- `schema.prisma` copied exactly from `04_DATA_MODEL.md`; initial SQL migration with all eight models and six enums.
- Separate API process health and PostgreSQL readiness checks; development OpenAPI docs.
- HTTP tests for healthy and failing database probes, a real-database smoke command, and a GitHub Actions workflow.
- Setup, development, verification, safety constraints, and future prerequisites documented in the root README.

## Verified in the current environment

- Node.js 24.18.0 and npm 10.8.2 are available (`npm.cmd` works around the PowerShell script policy).
- Project JSON parses and the Prisma schema is identical to the source document.
- All 14 TypeScript/TSX source files pass syntax transpilation with locally cached TypeScript 5.9.3; the four JavaScript configuration/setup scripts pass Node syntax checks. The dependency-free server environment validator and shared contracts also pass strict TypeScript checking. This does not replace the pending full workspace typecheck or lint run.
- Local environment files were created without overwriting existing files.
- Initial SQL was produced by an offline schema diff with an already-cached Prisma schema engine. The in-memory datasource declaration was adapted for that tool; the committed Prisma 6 schema was left unchanged. This is SQL generation, not proof of a live migration or Prisma 6 CLI validation.

## Still required to finish Phase 0

- Allow dependency/package and Prisma engine downloads. Automatic approval review failed with a 404 from its own review-service endpoint; npm registry access was denied in the sandbox. Explicit download approval has been requested.
- Complete `npm install`, resolve/check the Expo-supported dependency versions and OS minimums, and generate `package-lock.json`. The CI workflow depends on that lockfile.
- Start Docker Desktop with Linux containers (the user is installing/starting it), then apply the migration to PostgreSQL and check migration status.
- Generate Prisma Client; run lint, TypeScript, HTTP tests, API build, and the live database smoke check.
- Export both mobile platform bundles and boot the app on a compatible phone or simulator. Android SDK tools exist here, but no Android virtual device was listed. iOS simulator verification requires macOS; a physical iPhone is another local preview option.

No runtime checks above have been marked passed. No Phase 1 features or later-phase product decisions have been implemented.

## Next phase

After Phase 0 is verified and you say “continue,” Phase 1 adds Supabase Auth or Clerk, username selection and uniqueness checks, user creation linked to the managed identity, and session persistence. Your provider choice and minimum-age decision are needed before implementing account creation. No design assets are needed for Phase 0.
