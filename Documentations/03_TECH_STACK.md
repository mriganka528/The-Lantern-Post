# Tech Stack
## Lantern Post

Current audio implementation: **expo-audio 57.0.5** on native, browser **MediaRecorder / HTMLAudioElement**, IndexedDB for browser clips and Expo FileSystem for native clips. Server-side private S3-compatible signing uses Node crypto. Live storage/moderation credentials and device builds remain deferred; see `16_PHASE_7_HANDOFF.md`.

| Layer | Choice | Why |
|---|---|---|
| Mobile framework | **Expo (React Native)**, Expo Router, EAS Build | Your requirement — multi-OS, managed workflow, OTA updates, wide OS-version support |
| Language | **TypeScript** everywhere (client + server) | One language, shared types, fewer runtime bugs |
| Client state | **TanStack Query** (server cache) + **Zustand** (UI/local state) | Lightweight, avoids Redux boilerplate |
| Client animation | **Lottie (`lottie-react-native`)** and/or **Rive**, plus **react-native-reanimated** + **react-native-skia** | Vector-based = small bundle, smooth on low-end devices, fits fairytale illustration style |
| Local/offline storage | **expo-sqlite** or **AsyncStorage** | Draft autosave, offline send queue |
| Audio | **expo-av** (or **expo-audio**) | Voice note recording/playback, client-side compression |
| Backend framework | **NestJS** (Node.js, TypeScript) | Structured modules (auth, letters, friends, moderation) as the app grows; Fastify is a lighter alternative if preferred |
| API style | **REST + OpenAPI** (tRPC viable alternative) | Simple to consume from Expo, easy to rate-limit/cache |
| ORM | **Prisma** | Your requirement |
| Database | **PostgreSQL** (managed — Supabase, Neon, or RDS) | Your requirement; relational fit for users/friendships/letters/moderation |
| Auth | **Supabase Auth** or **Clerk** (managed) | Avoid building session/password security yourself; swap for custom JWT later if needed |
| Object storage | **Cloudflare R2** (S3-compatible, cheap egress) or **AWS S3** | Voice notes, character/palace art, served via CDN |
| CDN | **Cloudflare** (or provider-bundled CDN, e.g. CloudFront) | Fast, cheap asset delivery worldwide |
| Background jobs | **BullMQ + Redis** | Async moderation, transcoding, scheduled hard-delete sweeps, push dispatch |
| Caching | **Redis** | Infinity World viewport queries, friend list reads |
| Push notifications | **Expo Push Notification Service** | Native integration with Expo, no extra SDK needed |
| Text moderation | Hosted moderation API (e.g. **OpenAI Moderation endpoint**, or **Hive Moderation**) | Fast to integrate, avoid building a classifier from scratch |
| Hosting (API) | **Fly.io**, **Render**, or **AWS ECS/Fargate** | Stateless containers, easy horizontal autoscaling |
| Hosting (DB) | **Supabase** or **Neon** (serverless Postgres, branching, pooling built-in) | Pairs well with Prisma; connection pooling matters at scale |
| CI/CD | **EAS Build/Submit** (mobile), **GitHub Actions** (backend) | Standard, low-maintenance |
| Error/monitoring | **Sentry** (client + server) | Crash-free session rate is a stated success metric |
| Analytics | **PostHog** or **Amplitude** (privacy-conscious config) | Track D1/D7 retention, time-to-first-send, etc. |

## Explicitly avoided (and why)
- **3D engines (Unity/Godot/Unreal)** — bundle size, complexity, fights "not too bulky"
- **Real-time sockets/multiplayer sync for animation** — not needed; adds operational complexity for no user-facing benefit
- **NoSQL for core data** — relational structure (friendships, ownership, moderation joins) fits Postgres much better than a document store
- **Self-hosted auth from scratch** — high security surface area for little differentiation at MVP stage

## Version/OS support target
- iOS: last 3 major versions (Expo SDK's supported range at time of build)
- Android: API level per current Expo SDK minimum (typically Android 6.0+/API 23+, verify against the Expo SDK version you pick)
- Always check the specific Expo SDK release notes at build time for exact minimums — these shift with each SDK release.
