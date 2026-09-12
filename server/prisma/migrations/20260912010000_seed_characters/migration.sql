-- Curated Phase 2 artwork is bundled in the app. No external CDN is required.
-- Additive seed: preserve existing IDs, assignments, and operator activation choices.
INSERT INTO "Character" ("id", "key", "displayName", "assetUrl", "isActive") VALUES
  ('char_fox_lantern', 'fox-lantern', 'Ember', 'bundled://characters/fox-lantern', true),
  ('char_rabbit_moon', 'rabbit-moon', 'Lune', 'bundled://characters/rabbit-moon', true),
  ('char_owl_scholar', 'owl-scholar', 'Orion', 'bundled://characters/owl-scholar', true),
  ('char_deer_dawn', 'deer-dawn', 'Flora', 'bundled://characters/deer-dawn', true),
  ('char_cat_astral', 'cat-astral', 'Celeste', 'bundled://characters/cat-astral', true),
  ('char_swan_cloud', 'swan-cloud', 'Sol', 'bundled://characters/swan-cloud', true)
ON CONFLICT ("key") DO UPDATE SET
  "displayName" = EXCLUDED."displayName", "assetUrl" = EXCLUDED."assetUrl";
