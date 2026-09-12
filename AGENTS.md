# Lantern Post

Build the phase the user requests, using `Documentations/05_IMPLEMENTATION_PLAN.md` and the latest handoff for context.

The user is prioritising the complete in-app product and browser development. Android APK builds, EAS/Firebase configuration, and live device push setup are deferred until they explicitly return to that work. Preserve the prepared native setup without making it a prerequisite for building later product features.

The user also chose to leave live moderation unconfigured while building and testing. Preserve the server moderation boundary; do not silently approve live deliveries or introduce a production test bypass. Journey previews must be labelled, keep drafts intact, and make no send request. Use isolated test providers to verify delivery until a real provider is configured.

The user's enduring visual direction is **fairy tale, heavenly, vintage, and iconic**, including interactions such as opening palace doors. Carry this through every new screen, illustration, loading state, and transition. Read `Documentations/09_ART_DIRECTION.md` before visual work. Preserve the ivory paper, aged gold, soft celestial colours, storybook companions, and ornamental architecture.

Animations should be gentle, skippable when they interrupt navigation, and respect reduced motion. Keep Expo's managed workflow and bundle the curated artwork for reliable rendering.

The user also requested a continuous arrival: after the gates open, the companion walks along the path to the palace. Keep the majestic background alive with a flowing river, waterfalls, queens on the terraces, and angels among the clouds. Preserve these additions in later phases.

The writing desk and presets should feel like an old palace scriptorium: carved wood, weathered paper edges, engraved borders, royal crests, muted ribbons, and antique wax. Preserve readable ink above the decorative paper layers.

The Burning World should feel like a majestic celestial fire kingdom, with floating temples, living flames, and a crowned fire guardian. Preserve zoom and pan, a slow progressive paper burn with visible charring, embers and ash, and time to explore the completed scene before returning. Keep the letter's ignition behind confirmed release and local cleanup; ambient realm flames can burn before confirmation.

The friendship court uses a royal guestbook, rose-covered sage gates, sealed invitation cards, and companions beside each friend's gate. Open a friend's gate only after confirmed acceptance. Keep recipient-only responses, mutual friendship checks, account isolation, and filtering of blocks in both directions when adding friend delivery.

Private letters retain their original antique stationery. The courier walks continuously to the selected friend's gate after confirmed delivery, and receiving opens a sealed envelope onto readable manuscript paper. Preserve durable delivery/cancellation receipts, pending-draft fences, current friendship/block checks, and the distinction between previews and real deliveries.

Backend configuration and private credentials belong in `server/.env`; client public settings belong in `client/.env`. Never put server credentials in client code or browser fixtures.
