# Lantern Post showcase

A separate Next.js App Router website for Lantern Post. Its package manifest, lockfile, source and artwork are self-contained. It is **not** an npm workspace of the Expo/Nest project and makes no calls to the private app API. It needs no database, authentication keys, paid services, API keys, remote fonts or image-generation service.

## Run locally

Use Node.js 22 or 24 (24 recommended).

```powershell
cd "D:\Mobile dev\The Lantern Post\showcase-website"
npm.cmd ci
npm.cmd run dev
```

Open **http://localhost:3100**. Port 3100 keeps this site separate from the API and Expo development servers.

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run start
```

The build uses Next's webpack mode consistently in development and production. All pages are prerenderable; there are no app API routes or server actions. `next.config.ts` bounds tracing to this folder so the parent mobile workspace is not pulled into the site.

## Deploy on Vercel

1. Commit this entire folder, **including `package-lock.json` and `public/art`**, and push your repository.
2. In Vercel, choose **Add New → Project** and import the GitHub repository.
3. Set **Root Directory** to **`showcase-website`** (lowercase, with a hyphen and no spaces).
4. Use framework **Next.js**, Node.js **24.x**, install command **`npm ci`**, and build command **`npm run build`**. `vercel.json` supplies the commands.
5. Leave **Output Directory** at the Next.js default. Do not set it to the mobile app's dist folder. This site does not need files outside its root directory; leave Vercel's outside-root source inclusion off.
6. No environment variables are required. Deploy on the free Hobby plan if eligible; no paid integration is used by this code.
7. Optionally set `NEXT_PUBLIC_SITE_URL` to your final HTTPS showcase URL and redeploy for social/share metadata and the sitemap. The Vercel production/deployment URL is used automatically when available.

No backend redeployment, database migration, Clerk callback change or Android rebuild is needed to deploy this website. A local successful build checks source/build readiness; it is not a claim that a Vercel deployment has already succeeded.

### Fixing an existing Vercel project after the folder rename

Vercel rejected the old `Showcase website/___next_launcher.cjs` function name because it contained a space. The folder is now `showcase-website`. Commit and push the rename, then open the existing Vercel project's **Settings → Build and Deployment → Root Directory**, select `showcase-website`, and save. Deploy the latest commit with **Use existing Build Cache** unchecked. Keep the Next.js framework and default output directory. The ESLint deprecation and `unrs-resolver` install-script warnings were not the reported invalid-function-name error.

Keep future folder names in the deployed path free of spaces. Do not edit the generated `___next_launcher.cjs` file; Vercel regenerates it during deployment.

## Change the APK link

Edit **`src/config/site.ts`**:

```ts
export const download = {
  url: "https://github.com/mriganka528/The-Lantern-Post/releases/download/v0.1.0/lantern-post-development.apk",
  isTemporary: false,
};
```

The current URL is the user-supplied **Lantern Post v0.1.0 — First Android Release** asset. `isTemporary` is false, so the old placeholder notices are hidden. Every APK download button uses this same setting, including the landing page and installation guide. The asset filename is used exactly as provided; this link update does not inspect or certify the APK's build mode. Redeploy after editing the link.

## Included pages and interactions

- `/`: an illustrated cover; an openable sample envelope; a three-step writing/stationery tour; interactive Infinity/friend/fire destinations; night/day preview; five actual app screenshots with an expandable gallery; ten selectable companions; features; getting-started steps; FAQ; APK download.
- `/guide`: Android installation, onboarding, multiple drafts, voice, sealing/sharing, destination visibility, friends/chat, encrypted backups, notification/motion controls, deletion and troubleshooting.
- `/privacy`: a plain-language showcase privacy notice and a summary of app privacy choices. It does not replace the still-to-be-finalized in-app legal policies.
- A custom 404 page, icon files, social card, robots and sitemap metadata.

The preview contains imagined example text, never a real user letter. Interactions use page memory only, with no cookies, analytics, microphone access, authentication or live sends. Native `dialog` supplies modal focus/escape behaviour; tabs have arrow-key navigation; CSS honours reduced motion. Artwork is locally bundled, compressed WebP with explicit image dimensions and lazy loading below the cover. Small CSS effects add no animation library.

## Artwork

The app's existing palace, companion and world assets were resized from `client/assets/storybook`; the website keeps its own finished copies under `public/art` and does not import from the client. The new lantern/envelope icon is derived from the image supplied by the user for the app. No decorative bird flocks were added; owl, swan and peacock remain selectable companions.

`public/screenshots` contains real captures of the current Expo app rendered at 390 × 844 in a browser, using isolated synthetic accounts/sample content: palace, writing desk, sealed letter, night Infinity World, and sample chat. These are not claimed as screenshots taken from an installed APK. They were compressed as WebP and can be replaced with device captures later without changing the gallery. No private account, production message, microphone or live send was used for the captures.

The site ships no `.env` files or server credentials. `.next`, node_modules and Vercel metadata are ignored. The root `.easignore` excludes this separate site from Android build uploads.

## Verification completed

- Next.js 16.3.5 production build: all pages and metadata routes prerender successfully.
- ESLint and TypeScript: pass.
- Browser checks against `next start`: no client errors, failed assets or third-party requests; 320–1440px responsive checks; dialog focus/escape; keyboard tabs; stationery and sealing previews; three worlds and night/day; ten companions; FAQ; mobile navigation; screenshot enlargement/keyboard controls; exact configured download URL.
- App screenshot captures use isolated sample content, not a live account. The screenshot gallery's own previews are in `.cache/showcase-review` at the repository root.
- The lockfile includes the Linux Next compiler. All 11 generated dependency-trace manifests remain inside this standalone folder.

This is local Windows production verification, not a completed Vercel deployment. The included Linux GitHub workflow runs installation, lint, build and typecheck after you push; that remote run has not been claimed as completed.
