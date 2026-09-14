# Lantern Post — enduring art direction

The user reaffirmed on 2026-09-12: **everything should feel fairy tale, heavenly, vintage, and iconic, including opening-door animations.** This applies to later phases as well as Phase 2.

The user subsequently asked for a continuous walk into the palace after the gate opens, plus a live river, waterfalls, queens, and angels for a majestic view. These are now part of the lasting art direction.

For Phase 4, the user asked for an even older palace look in the letter section and presets. The desk now uses a carved wooden setting and an illustrated writing chamber; papers have uneven weathered edges, subtle fibres and creases, engraved corners, and a royal crest. Presets appear as miniature manuscripts with ribbon and wax, with muted, aged palettes.

The Burning World refinement adds the user's request for a magical, majestic realm that can be zoomed into, with living flames, a fire god figure, and a letter that burns slowly into visible ash. Its original guardian is Aureon, Keeper of the Everflame: a serene crowned figure with a radiant halo, flame hair, embroidered robes, and fire in his hands. Floating temples, rivers of golden light, constellations, bridges, and a bronze altar continue the palace's storybook language in plum, amber, and aged gold.

Phase 5 carries this into a friendship court: a royal guestbook beneath pearl clouds, climbing roses on sage gates, aged stone, and quiet angels. Incoming invitations rest on parchment cards, while accepted friends become small engraved gates with their companions. A confirmed friendship opens ornate door leaves onto the friend's palace over about 1.25 seconds. The reveal waits for its frame to mount, can be dismissed immediately, and skips motion for the accessibility preference. Search, empty/error states, and device-alert settings use the same paper and ink.

Phase 6 extends the correspondence: a continuous 6.8-second courier walk crosses the river to the chosen friend's gate. Its doors reveal the recipient's companion as the envelope is placed inside. Reuse the palace, live water, royal/celestial figures and walking layers. Wait for the world to mount and delivery to be confirmed. A separate labelled preview must never send or change the draft; both paths support immediate return and reduced motion.

Received letters wait as miniature sealed manuscripts in the letterbox. Breaking the seal reveals the original paper, ink, crest, weathered edges and engraving, preserved from the stationery selected at send time. Keep the words readable and selectable above those layers. Use quiet postmarks and unopened markers rather than chat bubbles or read receipts shown to the sender.

Phase 7 adds an aged-brass gramophone and carved-wood base to the voice composer, with a quiet gold level meter and playback on the original manuscript paper. Microphone access begins only when Record is chosen. Ambient palace/fire motion defaults on and keeps the visitor's manual choice across screens and reloads; operating-system reduced motion and background suspension remain respected. Mount animation clocks together with their visible layers. Completed burns should invite a fresh letter instead of trapping the visitor in a previous realm visit.

## Visual language

The social refinement adds engraved username calling cards and three illustrated destination portals beneath a sealed letter. The private chat parlour uses candlelit wood, an ivory/sage transcript, manuscript message cards, small postmarks, the chosen friend's companion and royal controls. Keep text readable; no constant message animations or misleading presence indicators. Home feature sections are ordered writing desk, friendship gates, worlds, then companion/other details, preserving the arrival scene above them.

Phase 10 removes every bird from the Astral Palace at the user's request while retaining its river, waterfalls, queens, angels and continuous arrival. Other palaces keep their doves. The Royal Collection adds an opal unicorn, jeweled peacock, crowned lion and jade dragon with distinct embellished palaces, plus six lace/feather/rose/celestial/gilded stationery designs. All are included now, with collection tags for future premium access. Infinity gains more engraved gold, bridges, lanterns and celestial statuary baked into its background. Its letter stars are visually small (21 pixels) but keep 44-pixel targets; only the active hover/focus/press sparkle animates, briefly, with reduced-motion support. Brand/store assets use the same ivory paper, antique gold, lantern and arched frame.

Phase 9 opens the Infinity World: a pearl/lilac sky, moon disc, floating temples and waterfalls, a crowned gilt gateway, rose-covered cloud gardens, angels and doves. Bright selectable seals distinguish shared letters from decorative constellations. Nearby letters group into small circles of light. The companion follows a continuous 7.6-second path through the gate as an envelope rises into a star; preview is labelled, real animation waits for approval/cleanup, and either can be skipped. Public readers preserve antique stationery. New art is bundled from `infinity-art.tsx`, bringing the PNG set to 73 assets.

Phase 8 adds overlapping directional river highlights, faster waterfalls and ivory doves with wing beats. Angels and queens keep their gentle movement. The sealing court has gold columns, cloud temples, roses, lanterns, a crown and fairy lights around a skippable 3.2-second fold/ribbon/wax ritual. These bundled assets come from `sealing-court-art.tsx`. Ambient motion preserves the saved switch and reduced motion. Reports and closed-gate controls use warm paper, brass keys and calm language, with scrollable phone dialogs.

- Warm ivory and parchment, aged gold, sage green, dusty rose, moonlit blue, soft lavender, and pearl white.
- Storybook serif headings, quiet readable body text, and restrained italic captions. The current implementation uses Georgia on web/iOS and the native serif on Android; it needs no font downloads.
- Arched doors and windows, antique brass keys, wax seals, hand-carried lanterns, celestial ornaments, cloud gardens, and botanical details.
- Original companions with recognisable silhouettes and small personal objects. Curated, gentle compositions with room to breathe.
- Continue the same world through authentication, loading/error states, selection, palace rooms, and the eventual letter rituals.

Use `client/src/storybook/theme.ts` and `palettes.ts` as the implementation reference. Keep text readable against the pale backgrounds; reserve gold for ornaments and small accents.

## Motion and feeling

Interactions should resemble opening a treasured storybook or entering a sanctuary. Phase 2 opens a pair of ornate doors on their hinges, reveals the companion, and softly fades into the home. The entrance takes about 1.9 seconds, can be skipped or replayed, and completes immediately when reduced motion is enabled. Ambient stars move slowly and can be paused.

Phase 3 extends the arrival: the gate reveals the landscape, then the companion takes alternating steps across the river bridge toward the palace. The figure recedes with distance and turns toward the visitor at the steps. The walk lasts about 3.6 seconds and has a separate skip action. Skipping the gate skips the walk too. The scene includes flowing water highlights, twin waterfalls, terrace queens, and gently hovering angels. The ambient toggle stops water and sky motion; reduced motion also skips the entrance and letter-folding animations.

The writing desk continues the same materials through six stationery choices, faint paper textures, ornamental borders, ribbon, and wax seals. The sealing sequence folds the paper, closes the flap, and stamps the wax. It waits for the accessibility preference to be known before animating and can be skipped.

The Burning World uses a layered 1600 × 1000 realm. Visitors can zoom from 100–300%, drag or pinch, and focus on the guardian or letter. Web also supports Ctrl/trackpad scroll, a focused mouse wheel, plus/minus and arrow keys, and zero to reset. Bound the camera within the artwork. Ambient flames and the guardian's glow breathe gently, can be paused, and stop in the background or under reduced motion.

After explicit confirmation, server acknowledgement, and local cleanup, the letter descends toward the brazier. Over eleven seconds, its lower edge chars and curls, the paper is progressively consumed without shrinking, the wax drops, and drifting ash and golden embers settle into a visible pile. The ceremonial engraving is decorative; do not keep the user's cleared words for animation. Scroll the ritual into view once after confirmation. Keep its skip action, complete immediately under reduced motion, and let the visitor explore the final scene until choosing to return. Ambient fire is distinct from the letter's ignition: pending/error states must never look like a completed release.

Start any selection-dependent ritual after the server confirms the save. Stop animations when their screens unmount. Loading and network failures should leave a clear, usable path forward.

## Phase 2 companions

| Companion | Character | Palace | Details |
| --- | --- | --- | --- |
| Ember | Lantern fox | The Amber Palace | Honey stone, sage roofs, a warm lantern |
| Lune | Moon rabbit | The Moonflower Palace | Silver lilac, crescent moon, moonflowers |
| Orion | Scholar owl | The Starlight Library | Blue roofs, spectacles, books and stars |
| Flora | Dawn deer | The Rosewood Palace | Blush arches, climbing roses, antlers |
| Celeste | Astral cat | The Astral Palace | Violet observatory, star charm, armillary |
| Sol | Cloud swan | The Cloud Palace | Pearl and mint, crown, swan fountain |

These names and stories are the initial curated set for the requested Phase 2; they remain editable product content.

## Artwork and future refinement

Phase 11 removes every decorative flock and etched background bird from all palace/world scenes, preserving angels, queens, rivers, waterfalls, architecture and ambient light. Bird companion choices remain. The correspondence cabinet uses ivory cards, engraved gold edges and readable labels. Each chosen companion has a seated desk portrait with a candle, inkwell and manuscript: quill motion follows typing and the microphone light follows actual recording. Compact phone layouts keep the companion above the page. Exported letter copies reuse the original paper texture, coloured engraving and readable ink; no new continuous background loops are introduced.

The cabinet refinement brings the navigation into the same world: a deep sage panel, aged gold engraving, a royal crest and ivory arched buttons with medallion icons. The desk has one header containing My palace, My letters and New letter. Other story screens reuse the royal framing. Keyboard focus is explicit, hover/press feedback is brief, and idle navigation starts no clock. Cabinet entries resemble numbered folios with inset gold borders; removing a draft uses a clear confirmation on readable ivory paper.

Phase 2 includes original code-authored vector placeholder illustrations, with editable sources in `client/artwork-source/`. Their SVG and PNG outputs live in `client/assets/storybook/`. The app uses the PNGs on web, Android, and iOS, with no extra native renderer or remote art dependency. The 23 PNGs total about 3 MB. The scene architecture is shared, with distinct palettes, objects, and motifs for each palace.

Phase 3 expands that set to 45 PNGs, about 3.7 MB in total, including six companions' walking body/foot layers, water highlights, and queen/angel figures. Layers share a 1200 × 660 scene coordinate system so they stay aligned when the view scales. Letter paper and envelopes are composed directly with native views and the existing ornaments.

Phase 4 adds fourteen assets: a paper silhouette, three aged textures, four engraved borders, a crest, wood grain, a writing chamber, a hearth, and two flame layers. All have editable SVG/TypeScript sources in `client/artwork-source/antique-letter-art.tsx`. Typed letter content must remain above the paper artwork; decorative image layers are not interactive.

The Burning World refinement adds nine assets from `client/artwork-source/ember-realm-art.tsx`: the realm, guardian, altar, soft glow, two living flame layers, ceremonial engraving, a charred paper edge, and settled ashes. The full bundled set is now 68 PNGs, about 9.9 MB. Keep the editable SVG outputs beside them. The camera and progressive burn use core React Native APIs and introduce no native package.

Phase 5 adds `friendship-court.png` from `client/artwork-source/friendship-art.tsx`, bringing the curated set to 69 PNGs, about 10.2 MB. Small friendship gates are native views; their opening uses the existing bundled door and palace artwork. Keep body text above decorative layers and never expose delivery or push implementation details as part of the story.

The planned Lottie package could not be downloaded because automatic approval review failed with a service 404. The burn is implemented with the existing React Native Animated system and bundled artwork, so no missing player or new native dependency is required. Replacing the renderer later should preserve the acknowledgement, cleanup, skip, and reduced-motion behaviour.

`scripts/render-storybook-art.mjs` regenerates the assets using TypeScript, React's static renderer, Playwright, and a local Chrome browser. It does not use an AI image API. Playwright can be installed separately into `.cache/art-tools`; it is optional for running or building the app because the finished artwork is checked in. Set `STORYBOOK_BROWSER_CHANNEL=msedge` to use Edge instead of Chrome.

The imagegen skill was inspected, but its built-in tool was unavailable in the implementation session. No CLI image API was used. Custom painted art or sound can refine these assets later while preserving the established art direction and component boundaries.

## Latest phone refinement ? 14 September 2026

The user now requests minimal decoration on links/buttons because the enlarged royal controls crowded phones. This supersedes the earlier large framed-button treatment. Preserve palace artwork, ivory/aged gold/sage and storybook paper, but use compact 44-pixel actions with thin borders, small optional icons and simple focus feedback. Phone workspace navigation uses text labels. Stack the friendship title and action rather than squeezing the title beside a wide button. The letterbox has a small envelope heading and clear link. Phone destination portals become compact illustrated cards; desktop portals keep their full art. Keep comfortable dialog and manuscript width at 320?430 pixels.

The subsequent refinement adds a little celestial detail to Infinity actions: a restrained parchment panel, tiny flourishes, a serif caption, star/moon icons and thin gold borders. Keep phone controls compact and aligned, rather than reverting to oversized medallions. The local welcome notification uses warm palace language without personal content.

Infinity now opens at night on every new visit. Its indigo sky, lavender clouds, glowing moon, warm palace windows and lantern pools reuse the established architecture in one bundled night image. The original day artwork is available through a compact Day view / Night view switch. Gold letter glyphs remain small and readable on a dark halo at night. No additional ambient loops or decorative birds are added.

The notification bell is a small engraved brass glyph in a 44-pixel ivory/gold circle at the upper right of the signed-in header, with a restrained burgundy unread badge. Its scrollable ivory panel uses warm parchment arrival cards, serif titles and clear timestamps/actions. Phone desk navigation keeps a separate full-width row; do not add a constant swinging animation.
