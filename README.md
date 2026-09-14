# Lantern Post

Write it. Seal it. Let it go.

The default backend is `https://the-lantern-post.onrender.com`, deployed according to the user. Browser and native development both use it; a local backend is optional. Start the browser with `npm run dev:web -- --clear` or the development APK with `npm run dev:mobile -- --dev-client --clear`. The Render service needs the latest server revision plus `WEB_ORIGINS=https://the-lantern-post.onrender.com` and `DEVELOPMENT_WEB_ORIGINS=http://localhost:8081,http://127.0.0.1:8081` for local browser development. See [the Render default handoff](Documentations/41_RENDER_DEFAULT_HANDOFF.md). Use `npm run api:local` for explicit local operation and `npm run api:hosted` to return; restart Expo after switching. Automated moderation remains disabled.

The Expo app and NestJS API defined in [Documentations](Documentations/README.md). The five specification documents remain the reference, with the user's subsequent choices recorded in the handoffs. The user has requested a browser preview and a simpler client/server layout.

**Current work: Phase 10 — Royal Collection and product hardening.** The Astral Palace keeps its living scenery without birds. Four new companions and six ornate stationery presets form the Royal Collection, free for everyone now. Infinity stars are smaller and sparkle on interaction. This phase also adds confirmed-letter reconnect recovery, optional written voice captions, local support resources, retention, opt-in diagnostics and brand/store assets. See [the Phase 10 handoff](Documentations/19_PHASE_10_HANDOFF.md).

Live moderation, private object-storage credentials and Android/device setup remain unconfigured. Recording, local playback, burning and labelled journey previews work without those delivery integrations. Real friend delivery requires approval; isolated test services exercise the complete flow without a production bypass.

The walking palace arrival, live scenery, antique writing desk and stationery, and zoomable Burning World with its fire guardian and eleven-second paper burn are preserved.

Phase 10 adds the Royal catalogue, voice-caption fields and optional diagnostics. Stop the API with **Ctrl+C**, regenerate Prisma, and apply pending migrations. Run from the repository root:

```powershell
# Terminal 1
npm.cmd run db:generate
npm.cmd run db:status
npm.cmd run db:deploy
npm.cmd run dev:server
```

```powershell
# Terminal 2
npm.cmd run dev:web -- --clear
```

Open **http://localhost:8081**. The browser needs a valid publishable key in `client/.env`; finishing sign-in also needs Clerk verification settings and the Neon database in `server/.env`.

The Expo project root is `client/`. From the repository root, use `npm.cmd run dev:web -- --clear` for the browser or `npm.cmd start -- --clear` for Expo Go (`dev:mobile` remains available). To call Expo directly from the repository root, use `npx.cmd expo start ./client --web --clear`. Inside `client/`, use `npx.cmd expo start --web --clear`. The extra `--` belongs to npm script forwarding; it is not needed between `expo start` and `--clear`.

If Metro reports `Unable to resolve "../../App"` from `expo/AppEntry.js`, stop it with **Ctrl+C** and restart using one of those commands. That error occurs when Expo starts in the repository root and selects its default `App` entry instead of the client's `expo-router/entry`. The root `app.config.js` now catches this mistake early and prints the correct commands. The root TypeScript configuration is a workspace shell; `client/`, `server/`, and shared types keep their own configurations.

## Project structure

```text
client/                    Expo app: browser, iOS, and Android
  app/                     Auth, palace, friendship court, writing desk, private letterbox
  src/                     Client components, auth, API requests, and config
  artwork-source/          Editable original vector illustrations
  assets/storybook/         Bundled palace scenery, walking layers, antique paper, and hearth art
  test/                    Client request, session, and web configuration tests
  .env                     Public client configuration
server/                    All backend implementation and configuration
  src/                     NestJS: auth, users, characters, presets, letters, friends, notifications
  prisma/                  Schema and migrations
  prisma.config.ts         Prisma configuration
  test/                    Backend tests
  scripts/                 API smoke check
  compose.yaml             Optional local PostgreSQL
  .env                     Neon credentials, Clerk verification, CORS, API port
packages/shared-types/     Explicit public API types; no Prisma model exports
scripts/                   Shared environment-file setup
.github/workflows/ci.yml   Lint, types, API checks, migrations, mobile exports
```

The mobile app remains in Expo's managed workflow. Authentication uses `@clerk/expo` with SecureStore; TanStack Query scopes metadata to each session. Bundled art and React Native Animated provide palace, sealing, burn and courier motion. Draft-v5 metadata uses local files/localStorage, with voice bytes in native files or IndexedDB. Expo Audio captures native AAC and MediaRecorder captures browser Opus/AAC. Burning audio is never uploaded. Friend/public letters use explicit confirmation and access checks before delivery; automated content review is disabled for the current release. The Infinity World fetches bounded marker pages and reveals a username only for signed letters. Live moderation, Redis/BullMQ workers and device setup remain deferred.

## Requirements

- Node.js 24 LTS and npm 10 or newer. The repository uses npm workspaces.
- A Neon PostgreSQL connection string in `server/.env` as `DATABASE_URL`. Docker is optional and is not required to use Neon.
- Expo Go compatible with the selected Expo SDK, on a physical phone or Android emulator. An iOS simulator requires macOS and Xcode.
- Package-registry access for npm dependencies and Prisma engine downloads.
- A Clerk development application with email verification codes and Google enabled. Expo uses its publishable key; the API uses a server-only secret key to retrieve signing keys automatically.

The client uses Expo SDK 57 with matching React/React DOM versions and React Native Web. Clerk manages authentication in the client, and its backend SDK verifies the resulting sessions in NestJS. Native device support and release-note OS minimums still need confirmation before release. Prisma is pinned to **6.19.3** to preserve the supplied schema syntax. A separate SQL migration enforces the approved username format without changing entities or relations.

## First setup

Run from the repository root. PowerShell commands use `npm.cmd` because this computer blocks the `npm.ps1` wrapper. On macOS/Linux, use `npm`.

```powershell
npm.cmd run setup:env
npm.cmd install
npm.cmd run db:generate
npm.cmd run db:status
npm.cmd run db:deploy
npm.cmd run db:status
```

`setup:env` copies `server/.env.example` and `client/.env.example` without overwriting existing files. The former root database settings and API settings have been merged into `server/.env`, preserving their values. NestJS and Prisma both load that file. Explicit process environment variables take precedence for deployment and CI. The client uses only its own public environment file. Never put database credentials into `EXPO_PUBLIC_*` variables.

## Neon database setup

Save the PostgreSQL URL supplied by Neon in `server/.env`:

```dotenv
DATABASE_URL='postgresql://USER:PASSWORD@YOUR_ENDPOINT-pooler.REGION.aws.neon.tech/DB_NAME?sslmode=require&channel_binding=require'
```

Use the actual Neon value, not the placeholders above. Keep the URL in this one private file. The mobile app continues to call NestJS; it never connects directly to Neon.

The API uses the pooled URL as supplied. Prisma CLI uses a matching direct connection for migration work, derived by removing Neon's documented `-pooler` hostname label. You may set `DIRECT_URL` explicitly for a separate migration role, but it must refer to the same endpoint, database, and schema. Existing URL options are preserved; missing Neon settings default to required TLS, a 15-second connection timeout, and a five-connection runtime pool.

`server/prisma.config.ts` loads `server/.env` for every Prisma command. `PrismaService` uses the validated runtime URL explicitly. The current schema is `server/prisma/schema.prisma`; it includes burn/delivery receipts, friendship constraints, the notification outbox, and private-letter stationery snapshots.

`db:status` checks migration history; a new database reports pending migrations. Review that status before `db:deploy` applies the checked-in migrations. The third/fourth migrations seed companions and stationery. The fifth adds content-free burn receipts; the sixth ages stationery palettes; the seventh adds friendship constraints and notifications. Existing users, letters, activation settings, and selected companions are preserved. If Windows reports `EPERM` while replacing Prisma's query-engine DLL, stop the API before running `db:generate` again.

For future schema changes, use a dedicated development database/Neon branch and configure a **separate** `SHADOW_DATABASE_URL` before `npm.cmd run db:migrate -- --name descriptive_name`. The CLI refuses Neon development migrations without it, and validation rejects using the application database as its own shadow, including pooled aliases or a different schema in the same database. Deploying existing migrations does not require a shadow database. Do not use `db push` in place of migration history.

Optional local containers are available through `db:local:up` and `db:local:down`; stopping them preserves their data volume. Compose and its `POSTGRES_*` settings now live under `server/`. Starting a local container does not change the selected Neon URL. CI supplies an isolated PostgreSQL URL and does not use the private Neon connection.

Use `npm.cmd ci` with the checked-in `package-lock.json` for repeatable installs. Update the lockfile deliberately when changing dependencies.

## Clerk development setup

1. Use your Clerk **development** application with email codes and Google enabled. The app now offers both methods. Additional MFA/password screens are outside this flow.
2. Keep Clerk's username, first name, and last name requirements disabled. Lantern Post chooses and stores its own username after Clerk verifies the email.
3. Copy the application's **publishable key** (`pk_test_...`) into `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` in `client/.env`.
4. In `server/.env`, set `CLERK_PUBLISHABLE_KEY` to the same publishable key and `CLERK_SECRET_KEY` to the matching `sk_test_...` dashboard key. You do not supply `CLERK_ISSUER` or `CLERK_JWT_KEY`: the server derives its trusted issuer from the publishable key, and Clerk retrieves/caches the signing keys. The secret belongs only in `server/.env`.
5. `WEB_ORIGINS` lists exact HTTPS origins for the hosted API/browser frontend. Add trusted local previews through `DEVELOPMENT_WEB_ORIGINS=http://localhost:8081,http://127.0.0.1:8081` on Render and the local server. These settings apply to CORS, Clerk web token authorized parties and socket origins. Additional trusted token `azp` values may be listed in `CLERK_AUTHORIZED_PARTIES`; native tokens may omit that claim. Wildcards and public HTTP development origins are rejected.
6. Redeploy the hosted API and restart Expo after changing their respective settings. A local API restart is needed only when using local mode.

The authentication settings are:

```dotenv
# client/.env — publishable key only
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY

# server/.env — same publishable key plus the server secret
CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY
CLERK_SECRET_KEY=sk_test_YOUR_SECRET
CLERK_AUTHORIZED_PARTIES=
```

Use actual dashboard values in the ignored `.env` files. These placeholders are not working credentials. Existing `.env` files are preserved by `setup:env`; add missing Clerk variables from the examples. Never put a `sk_test_...` or `sk_live_...` secret into an `EXPO_PUBLIC_*` variable.

Clerk's backend SDK uses the server secret to retrieve this instance's signing keys from the Clerk API, caches them, and verifies token signatures and time claims. The API additionally checks the derived issuer, session identity/status, and authorized party. An unavailable signing-key service fails closed. Already-issued session JWTs can remain valid until their short expiration after sign-out; the app clears its active session and associated cache on sign-out.

Without the server secret, development health endpoints still boot, but authenticated requests fail closed. Production requires both Clerk keys. Automated tests use a local mock key endpoint and fake credentials; they do not contact Clerk, send verification email, or create Google accounts.

## Google sign-in

Click **Continue with Google** after confirming that you are at least 13. This confirmation is required before Google because Clerk can create an account on the first visit. Existing users return to their home screen; new users still choose a Lantern Post username.

- **Web:** Clerk redirects to `/oauth-callback`, completes its OAuth checks, and returns through `/oauth-complete`. A short-lived, tab-scoped timestamp preserves the age confirmation across the redirect; it contains no email, birth date, or token and is consumed once.
- **iOS/Android:** Clerk's `useSSO` opens the system auth browser through Expo. `expo-auth-session` generates the return URL. The app already declares the `lantern-post` scheme, giving native development/production builds the callback `lantern-post://oauth-callback`. Expo Go uses its current development `exp://.../--/oauth-callback` URL instead.
- If your Clerk instance restricts application redirects, allow the applicable app callback URLs. Keep Google's provider credentials and provider callback configuration in Clerk; no Google secret or separate native Google SDK is added to Expo.

The app name is **Lantern Post**, with the identifier `lantern-post` in Expo, workspace packages, API health responses, and native app links. Use `lantern-post://oauth-callback` in any Clerk native redirect allowlist. Names shown by Clerk's hosted screens or Google's consent screen are managed in those dashboards; set their display name to Lantern Post too if needed. Renaming the code does not rename those external accounts or the Neon database.

Cancellation leaves the user on sign-in. An incomplete provider flow never activates a session. If the temporary browser age marker is unavailable or expired, username onboarding asks for the confirmation again. Additional account-linking verification or MFA requirements must be completed before Clerk supplies an active session.

## Browser preview and native app

Run `npm.cmd install` once after this folder/dependency update to refresh the workspace links and web packages. The original root commands, including `dev:api` and `dev:mobile`, are retained.

Start the browser preview using the default Render backend:

```powershell
npm.cmd run dev:web -- --clear
```

Open **http://localhost:8081**. `dev:web` asks Expo to open the browser. `dev:mobile -- --clear` now also supports web; press **w** in that terminal to open it. Stop any old dev processes that were started before the folder move and restart using these commands.

`client/.env` keeps independent addresses for overrides; both default to Render:

```dotenv
EXPO_PUBLIC_API_URL=https://the-lantern-post.onrender.com
EXPO_PUBLIC_WEB_API_URL=https://the-lantern-post.onrender.com
```

Clerk manages browser sessions; Expo SecureStore is used only on native. The root layout keeps one visible browser CAPTCHA mount point beside the router for email, Google, callback, and loading screens. Navigation and verification-stage changes cannot remove or duplicate it. Google can create an account too, so CAPTCHA support is available on the sign-in screen. Authentication and username rules are shared across platforms. Finishing sign-in still requires valid Clerk verification settings on the server and migrated Neon tables.

During local development, Clerk's development-key notice, React's DevTools suggestion, and React Native Web's development/performance messages are expected. Production deployment uses matching Clerk production keys and a production build; changing local keys just to hide those notices would switch authentication instances. A Turnstile message about an unexpected source is its iframe-origin check rejecting a message. Keep that check enabled; after restarting Metro, close stale preview tabs and retry the flow. The CAPTCHA widget must remain visible if an interactive challenge is requested.

For production web output, set `EXPO_PUBLIC_WEB_API_URL` to the HTTPS API and configure the site's HTTPS origin in `server/.env` `WEB_ORIGINS` before building:

```powershell
npm.cmd run export:web
```

## Optional local API reference

Only when local operation is needed, select it and start the API in one terminal:

```powershell
npm.cmd run api:local
npm.cmd run dev:api
```

Restart Expo in another terminal. For a physical phone, select `api:local -- --url=http://YOUR_PC_LAN_IP:3000` instead of localhost. Return to Render with `npm.cmd run api:hosted` and restart Expo. Local development endpoints are listed below; the hosted API has the same paths except the development-only documentation endpoints.

| URL | Purpose |
| --- | --- |
| `http://localhost:3000/health` | HTTP 200 while the API is alive |
| `http://localhost:3000/health/ready` | Queries PostgreSQL; returns 200 when reachable or 503 without internal error details |
| `http://localhost:3000/docs` | Swagger UI in development/test |
| `http://localhost:3000/docs-json` | OpenAPI document in development/test |
| `GET http://localhost:3000/users/me` | Clerk-authenticated owner profile, or `{ "user": null }` before onboarding |
| `GET http://localhost:3000/users/username-availability?username=lantern_fox` | Authenticated username check |
| `POST http://localhost:3000/users/me` | Initial profile from `{ "username": "lantern_fox", "minimumAgeConfirmed": true }` |
| `GET http://localhost:3000/characters` | Authenticated active companion catalog with palace metadata |
| `POST http://localhost:3000/users/me/character` | Save a companion and its server-selected palace using `{ "characterId": "char_fox_lantern" }` |
| `GET http://localhost:3000/users/me/palace` | The authenticated owner's saved companion and palace |
| `GET http://localhost:3000/presets` | Authenticated active stationery catalog, with validated paper/seal/ribbon settings |
| `POST http://localhost:3000/letters` | Confirmed text/voice Burning World release; voice sends metadata only, and returns an owner-scoped, content-free outcome |
| `POST http://localhost:3000/letters` with `destinationType: FRIEND` | Confirmed, moderated private delivery to a current friend; returns a durable receipt |
| `GET http://localhost:3000/letters/burning/requests/:requestId` | Check the signed-in owner's release outcome after an interrupted reply |
| `GET http://localhost:3000/letters/friends/capabilities` | Separate text moderation, voice moderation and voice storage availability; currently false |
| `POST http://localhost:3000/voice/uploads` | Reserve a bounded private voice upload for one owner/request/recipient |
| `POST http://localhost:3000/voice/uploads/:assetId/finish` | Validate actual uploaded bytes and promote them to a sealed private object |
| `GET http://localhost:3000/letters/friends/requests/:requestId` | Check your private delivery outcome |
| `POST http://localhost:3000/letters/friends/requests/:requestId/cancel` | Durably cancel an unresolved delivery or recover its delivered outcome |
| `GET http://localhost:3000/letters/friends?box=received` | Received/sent envelope metadata, without text |
| `GET http://localhost:3000/letters/friends/summary` | Private letterbox counts |
| `POST http://localhost:3000/letters/friends/:id/open` | Authorised reading; first recipient opening marks it read |
| `POST http://localhost:3000/letters/friends/:id/delete` | Clear the letter from both palaces |
| `GET http://localhost:3000/friends/search?username=moon` | Authenticated username-prefix search with safe social cards |
| `GET http://localhost:3000/friends?view=friends` | The owner's friends, incoming, or outgoing invitations with pagination |
| `GET http://localhost:3000/friends/summary` | The owner's friend and invitation counts |
| `GET http://localhost:3000/safety/blocks` | Only the caller's closed gates, paginated |
| `GET http://localhost:3000/infinity/stars` | Viewport-bounded public markers; no authors or content |
| `GET http://localhost:3000/infinity/mine` | Only your own public markers |
| `POST http://localhost:3000/infinity/stars/:id/open` | Approved public text/voice; opt-in username only |
| `GET http://localhost:3000/infinity/requests/:requestId` | Owner-scoped public-sharing outcome |
| `POST http://localhost:3000/infinity/requests/:requestId/cancel` | Durable public-sharing cancellation |
| `POST http://localhost:3000/infinity/stars/:id/delete` | Confirmed owner-only public removal |
| `POST http://localhost:3000/infinity/stars/:id/block` | Block a public author without exposing unsigned identity |
| `POST http://localhost:3000/safety/blocks/:id` | Confirm a block and end friendship in both directions |
| `POST http://localhost:3000/safety/blocks/:id/unblock` | Remove only the caller's block; no automatic friendship restore |
| `POST http://localhost:3000/safety/letters/:id/report` | Save a recipient's report, optionally blocking its sender |
| `POST http://localhost:3000/friends/requests` | Send an invitation by username, reusing existing requests on retry |
| `POST http://localhost:3000/friends/requests/:id/respond` | Recipient-only accept or decline |
| `GET http://localhost:3000/notifications/settings` | Whether native device registration is enabled |
| `POST http://localhost:3000/notifications/register` | Bind an Expo installation token to the signed-in owner |
| `POST http://localhost:3000/notifications/unregister` | Remove only the signed-in owner's installation token |

Identity endpoints require `Authorization: Bearer <Clerk session token>`. The server derives identity from that verified token. Bodies containing `authProviderId` or undeclared fields are rejected. Usernames are trimmed/lowercased; PostgreSQL enforces uniqueness even when requests race. Repeating the same onboarding request returns the same account and cannot rename it. The second migration rejects existing invalid usernames rather than silently renaming them.

Prisma connects lazily, so the process health check can succeed during a database outage. Use the readiness endpoint to verify database access. Database migration status is checked separately by `db:status`. Production hosting must terminate HTTPS; the HTTP URLs here are for local development.

Before starting native preview, set `EXPO_PUBLIC_API_URL` in `client/.env` for the device:

| Device | Local API address |
| --- | --- |
| Android Studio emulator | `http://10.0.2.2:3000` |
| iOS simulator on the API's Mac | `http://localhost:3000` |
| Physical phone on the same Wi-Fi | `http://YOUR_COMPUTER_LAN_IP:3000` |

The app calls the API after Clerk restores or creates a session. Restart Expo after changing environment values. Physical-device access may require allowing the local Node.js server through your development firewall. Release builds require an HTTPS API URL.

In a second terminal:

```powershell
npm.cmd run dev:mobile
```

Scan the QR code with a compatible Expo Go client, or press `a` to open a configured Android emulator. On macOS, press `i` for an iOS simulator. Sign in, complete the required age confirmation, choose a username, and meet the companions. Existing users without a companion enter that selection step; returning users with a saved companion reach their palace. Native OAuth and animation behaviour still need an actual device check.

## Verification

```powershell
npm.cmd run db:validate
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build:api
npm.cmd run smoke:api
npm.cmd run check:dependencies --workspace @lantern-post/mobile
npm.cmd run export:mobile -- --platform android --output-dir dist/android
npm.cmd run export:mobile -- --platform ios --output-dir dist/ios
```

`npm test` runs API and client tests. API tests cover health, Clerk verification, identity spoofing, browser CORS, input validation, privacy, Neon configuration, and username conflicts with a controlled database provider. Client tests cover refresh, account changes, cancellation, web settings, and safe errors. Mock-backed tests do not prove live PostgreSQL behavior. `smoke:api` runs `server/scripts/smoke-api.mjs` against the compiled API and real database, then stops it. Configure `server/.env` and apply migrations first.

Mobile exports check that Metro can bundle the entry point for each platform; they do not prove that a native app boots. A phone/emulator check is required to complete the Phase 0 device deliverable.

Current status is in [the Phase 10 handoff](Documentations/19_PHASE_10_HANDOFF.md). After `npm.cmd test`, use `node scripts/check-phase10-ui.mjs` for Royal choices, bird-free Astral scenery, smaller interactive stars, non-blocking support, confirmed offline recovery, real voice captions and consent/error-recovery checks. Earlier scripts retain public/private delivery, burn and safety regressions. CI adds `test:hardening-db` to isolated PostgreSQL checks; these test scripts never read private `server/.env`.

Brand artwork is bundled under `client/assets/storybook`. Three 1080×1920 store previews are in `client/assets/store`; copy and regeneration notes are in [the store listing draft](Documentations/20_STORE_LISTING_DRAFT.md). Nothing has been published. The Royal metadata is reserved for future entitlements, with all active content included now. Live moderation/storage, native builds and live Sentry forwarding remain unconfigured or deferred.

## Safety requirements carried into later phases

- Use explicit response DTOs. Never return raw Prisma `Letter`/`User` objects. Unsigned Infinity World responses must omit sender identity entirely.
- Authorize friend-letter reads on the server, including current friendship and blocking rules.
- Check moderation before any letter becomes visible to the public or is delivered to a friend. Phase 6 must enforce this even though Phase 8 expands the pipeline.
- Hide burned content immediately and purge it according to the retention policy. Do not expose recovery endpoints.

These are implementation constraints for the later endpoints, not claims that Phase 0 implements moderation or access control.

## Accounts, decisions, and assets

Your Neon URL and API settings are now stored together in the ignored `server/.env`. Live migration and readiness checks require access to that database. The browser preview runs on the computer; a compatible phone/emulator is required for native verification. No new artwork is needed for these foundations.

You selected **Clerk**, **email verification codes and Google**, **13+ self-confirmation**, and **case-insensitive usernames of 3–24 lowercase letters, digits, or underscores**. Age confirmation is checked before sign-up/Google handoff and before creating a Lantern Post profile. No date of birth is collected. Live account/API verification requires matching Clerk keys and migrated Neon tables. Remaining PRD open questions will be resolved before their dependent features are built.

The project includes illustrated palace scenery, walking layers, queen/angel figures, live water, antique stationery, a celestial fire realm, friendship gates, private letter reading and an antique voice recorder. The user installed Expo Audio during this pass. Native build setup and live moderation remain deferred; private storage wiring is prepared but has no live credentials. Monitoring, hosting and store work remain in later phases. Nothing has been published.

The [Android guide](Documentations/14_ANDROID_NOTIFICATIONS_SETUP.md) is retained for later. Automated moderation is disabled for the current release at the user's request. Real delivery is enabled with explicit unreviewed metadata; provider integration is deferred to a later update. Authentication, reports, blocks, limits and receipt recovery remain active.

## Current product pass

The [Phase 11 handoff](Documentations/21_PHASE_11_HANDOFF.md) covers bird-free palace scenery, the multi-letter correspondence cabinet, explicit illustrated/audio copies in browsers, phone text sharing, and the selected companion writing or recording at the desk. The user chose publisher name **The Lantern Post** and minimum age **13** for the policy drafts. Native file sharing, final policy/operator details and live launch setup remain incomplete; see the [beta runbook](Documentations/24_BETA_RELEASE_RUNBOOK.md).

Restart the browser preview with `npm.cmd run dev:web -- --clear` and hard-refresh with Ctrl+Shift+R. Existing letters remain on the device. Run `npm.cmd run check:beta-ui`, `npm.cmd run load:infinity` and `npm.cmd run check:release` for the local browser rehearsal, isolated load report and launch inventory. These commands publish nothing.

The [cabinet refinement](Documentations/25_CABINET_REFINEMENT_HANDOFF.md) adds confirmed removal of unfinished text/voice letters and royal navigation throughout the story screens. Run `npm.cmd run check:cabinet-ui` for the removal, recording cleanup, stale-window and responsive-navigation rehearsal.

The [social refinement](Documentations/26_SOCIAL_PARLOUR_HANDOFF.md) adds username calling cards, illustrated destinations and protected real-time friend chat, and puts the writing desk before friendship gates, worlds and companion details on home. Chat needs the current database migrations. Live sends no longer require a moderation provider; the labelled sample parlour remains a separate preview. Run `npm.cmd run check:social-ui` for isolated browser verification. `Documentations` is ignored for new files; untracking its existing files still requires the manual Git step in the handoff.

## Privacy, chat sockets and backups

Account ? **Chat backups & privacy** opens the encrypted royal archive and confirmed account removal. Deploy the new `20260914040000_account_privacy_drive` migration with `npm.cmd run db:deploy` before starting the updated API.

Chat updates now use authenticated WebSockets at `/chat/socket`; durable HTTP send receipts remain in place. Automated moderation is disabled for this release. Local backups and direct Google Drive backups use AES-256-GCM with a recovery key kept by the user. Restored backups are read-only archives, never resent messages.

Direct Drive uses a Google OAuth **Web application** client and only `drive.appdata`. Register `https://the-lantern-post.onrender.com/backups/drive/callback`, enable the Drive API, then run `npm run setup:drive -- --credentials="PATH_TO_OAUTH_WEB_CLIENT_JSON"` and `npm run check:drive-config`. The importer saves all four `GOOGLE_DRIVE_*` settings together in `server/.env` and preserves the stable token-encryption key. Copy those values privately into Render and redeploy; no client secret belongs in `client/.env`. Do not use the Firebase notification service-account file for Drive OAuth. See the local [Google Drive setup guide](Documentations/42_GOOGLE_DRIVE_SETUP.md). Local backups remain available without Google configuration.

Android Google login and Drive authorization now have native account-sheet adapters. The required free SDK packages and Expo plugins are installed. Run `npm run check:native-google`, match `EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID` to Clerk's Google connection, and register the actual APK signing SHA-1/package in Google Cloud before device testing. The public app setting currently reuses the existing Drive Web client; its secret remains server-only. Deploy the updated API and build a new development APK; Metro reload cannot add native modules. Browser, iOS and older APK compatibility flows remain available. See the local [native Google handoff](Documentations/43_NATIVE_GOOGLE_HANDOFF.md).

Expo Sharing, ViewShot and DocumentPicker are installed; phone image/audio export and encrypted-file import/export are implemented. Actual Android/iOS share-sheet and picker verification remains deferred with device builds. `npm.cmd run check:privacy-ui` runs an isolated browser privacy rehearsal after API test compilation. See the local `Documentations/27_PRIVACY_SOCKETS_BACKUPS_HANDOFF.md` for setup and acceptance details.

## Sending without automated moderation

The current release defaults to `MODERATION_MODE=disabled` in the API. Chat, friend letters and public Infinity letters send after explicit confirmation and existing account/friendship/block/limit checks. No OpenAI key, Redis or moderation worker is needed. Uploaded audio still requires configured private storage and validation of its bytes, duration and ownership.

Apply `20260914060000_optional_content_review` with `npm.cmd run db:deploy`, then restart the API and browser client together. On Windows, stop the API before `npm.cmd run db:generate` if Prisma reports a locked engine DLL. The new records carry `moderationSkipped=true`, `moderationPassed=null`, and no review timestamp. Existing approvals stay unchanged. A future `required` mode will stop new sends until a real provider exists; it does not automatically enable one.

`npm.cmd run check:unreviewed-ui` verifies the real disabled-mode service with socket chat between two synthetic accounts, private delivery and unsigned public-star reading. See `Documentations/28_UNREVIEWED_DELIVERY_HANDOFF.md`.

## Free voice storage and optional voice backups

Voice drafts stay on the phone/browser. Sending to a friend or Infinity uploads a private delivery copy so others can listen while the sender is offline. This release supports **Supabase Free** without adding an SDK or paid service. Keep the project on Free and do not add a payment method. Provider quotas apply; live signup terms must be checked in the dashboard.

Create a Free Supabase project, then add its project URL and **legacy service_role** key to `server/.env` (never client/.env). Set a dedicated private bucket name:

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_VOICE_BUCKET=lantern-voice
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_LEGACY_SERVICE_ROLE_KEY
VOICE_STORAGE_BUDGET_BYTES=268435456
```

Leave the old `VOICE_STORAGE_ENDPOINT`, `VOICE_STORAGE_BUCKET`, `VOICE_STORAGE_REGION`, `VOICE_STORAGE_ACCESS_KEY_ID` and `VOICE_STORAGE_SECRET_ACCESS_KEY` empty when selecting Supabase. Run `npm.cmd run setup:voice-storage`; it builds the API, creates the private bucket if missing, and checks a tiny synthetic upload/read/playback/delete without touching application data. Restart the API afterward. No database migration is needed for this pass.

**Account ? Chat backups & privacy ? Your voice, kept close** lets users make an encrypted voice keepsake locally or in connected Google Drive. One recording per backup; including its caption is optional. Keep the recovery key separately. After reinstalling, sign in to the same account and reopen the backup to listen or save the audio. This never sends a new letter. Google Drive OAuth configuration remains its separate optional setup step.

See `Documentations/29_FREE_VOICE_STORAGE_HANDOFF.md` for exact setup, free-tier limits and verification. `npm.cmd run check:voice-backup-ui` runs the isolated browser rehearsal after API test compilation.

## Live palace and independent letter copies

Friendships, letterboxes and arrival banners now update through `/events/socket`, alongside `/chat/socket` for open conversations. Both socket routes need HTTP upgrade support in a production reverse proxy. Events contain routing metadata only, with bounded owner-scoped cursors and a three-second database fallback for other server instances. In-app arrival alerts are available in Account and the friendship court; they default on, pause in the background and avoid duplicate alerts in the currently open chat.

Private-letter removal now hides only your own copy. The other participant keeps theirs; shared contents and audio are purged after both remove it. Full account erasure remains a separate confirmed action. Content erased under the previous behavior cannot be reconstructed by this update.

Apply the new `20260914080000_live_palace_independent_letters` migration with `npm.cmd run db:deploy`, then restart API and web. This migration is additional to the previously completed database setup. Chat acknowledgements appear immediately without skipping earlier incoming messages; voice API uploads validate/promote in one request and no longer need a second finish request. The courier still walks continuously, with a shorter skippable ceremony.

Phone push is prepared for chat, private letters and invitations. The user chose browser-only development for now, so actual EAS/Firebase setup and device testing remain deferred. See `Documentations/30_LIVE_PALACE_HANDOFF.md`. `npm.cmd run check:live-palace-ui` verifies live alerts, private-copy deletion and royal controls with isolated accounts.

## Palace guidance

The app offers a nine-step, first-visit tour that points to the actual palace controls and sections. It opens after the first completed palace entrance, can be skipped or finished, and can be replayed from **Guidance**, the permanent home section, or **Account → Replay palace guidance**. The choice is stored on the installation/browser profile, contains no account or letter data, and does not require a backend change. Tours never send or edit a letter and return to the starting scroll position when closed.

`npm.cmd run check:guidance-ui` runs the isolated browser walkthrough after the existing API test fixtures have been compiled. See `Documentations/45_PALACE_GUIDANCE_HANDOFF.md` for implementation, checks and native verification boundaries.

## Separate showcase website

The independent Next.js site lives in **`showcase-website/`**, with its own package manifest, lockfile, public artwork and actual app screenshot gallery. Run `npm.cmd ci` and `npm.cmd run dev` from that folder, then open http://localhost:3100. It uses no app API or private credentials.

For Vercel, set Root Directory to `showcase-website`, use the Next.js framework and Node 24, and leave the output directory at its default. Read [the showcase setup guide](showcase-website/README.md) for full deployment instructions. Change the temporary APK link in `showcase-website/src/config/site.ts`. Keep the folder name free of spaces: Vercel includes it in generated function names. The mobile EAS upload excludes the showcase folder.
