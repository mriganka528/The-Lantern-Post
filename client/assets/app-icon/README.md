# Phone icon artwork

The colour icons use the exact lantern, sealed-letter and moonlit-palace image supplied by the user on 15 September 2026. The original is preserved in `../../artwork-source/launcher-original.png` (1254 × 1254). No image-generation service or external asset URL is used.

- `icon.png`: 1024 × 1024 opaque RGB icon for iOS and older Android launchers. The transparent mockup margin/shadow is removed; the OS applies its own corners.
- `adaptive-foreground.png` and `adaptive-background.png`: 1024 × 1024 Android adaptive layers. The sharp painting is centred with room for launcher masks; softly extended painting colours fill the background.
- `monochrome.png`: transparent white lantern/envelope glyph for Android themed icons, derived from `../../artwork-source/launcher-monochrome.svg`. Android supplies the user's wallpaper colour.
- `notification.png`: 96 × 96 white-on-transparent notification symbol. Android requires a silhouette here instead of the full-colour painting.
- `favicon.png`: 64 × 64 web icon.

`client/app.json` selects these assets. Expo generates the Android density resources and iOS icon catalogue during native builds. The existing in-app storybook ornaments and splash mark are separate.

Regenerate from the repository root with `node scripts/render-app-icons.mjs`. This uses the same optional local Playwright/Chrome artwork tools as `render-storybook-art.mjs`; the checked-in PNGs require no artwork tools to run or build the app. `STORYBOOK_BROWSER_CHANNEL=msedge` selects Edge instead of Chrome. Review `.cache/app-icon-review/preview.png` after changing the source/crop.

The original is intentionally separate from the storybook renderer, so regenerating palace illustrations cannot overwrite the phone icon. A new APK must be built and installed to update an existing installation's launcher/notification icons; Metro reloads cannot replace native resources.
