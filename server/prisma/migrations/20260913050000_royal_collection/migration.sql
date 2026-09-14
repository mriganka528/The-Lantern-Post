-- Royal is a curated collection for future entitlements. All items are free now.
-- Preserve existing users, IDs and operator activation choices on conflict.
INSERT INTO "Character" ("id", "key", "displayName", "assetUrl", "isActive") VALUES
 ('char_unicorn_aurelia','unicorn-aurelia','Aurelia','bundled://characters/unicorn-aurelia',true),
 ('char_peacock_seraph','peacock-seraph','Seraph','bundled://characters/peacock-seraph',true),
 ('char_lion_solstice','lion-solstice','Aurel','bundled://characters/lion-solstice',true),
 ('char_dragon_jade','dragon-jade','Jade','bundled://characters/dragon-jade',true)
ON CONFLICT ("key") DO UPDATE SET "displayName"=EXCLUDED."displayName", "assetUrl"=EXCLUDED."assetUrl";

INSERT INTO "Preset" ("id","key","displayName","configJson","isSeasonal","isActive") VALUES
 ('preset_royal_moonlace','royal-moonlace','Royal Moonlace','{"version":1,"order":10,"collection":"royal","description":"Pearl lace, opal moons and an engraved silver-lilac ribbon.","paperColor":"#F1E5C8","inkColor":"#493B3E","sealColor":"#87708A","ribbonColor":"#978AA4","texture":"vellum","motif":"lace","font":"script"}',false,true),
 ('preset_peacock_court','peacock-court','Peacock Court','{"version":1,"order":11,"collection":"royal","description":"Feathered jade borders and a sapphire fan beneath antique wax.","paperColor":"#E2E7CE","inkColor":"#324B44","sealColor":"#3E7770","ribbonColor":"#7D9B87","texture":"linen","motif":"peacock","font":"classic"}',false,true),
 ('preset_rose_pearl','rose-and-pearl','Rose & Pearl','{"version":1,"order":12,"collection":"royal","description":"Climbing roses, tiny pearls and a weathered blush manuscript.","paperColor":"#F1DDD1","inkColor":"#5E3E3E","sealColor":"#9C5B62","ribbonColor":"#BB9B97","texture":"parchment","motif":"rose-vine","font":"script"}',false,true),
 ('preset_celestial_atlas','celestial-atlas','Celestial Atlas','{"version":1,"order":13,"collection":"royal","description":"An engraved star atlas with moon medallions and velvet-violet wax.","paperColor":"#E0DDEB","inkColor":"#3F3857","sealColor":"#6E5B91","ribbonColor":"#9690B4","texture":"vellum","motif":"celestial","font":"book"}',false,true),
 ('preset_sovereign_gold','sovereign-gold','Sovereign Gold','{"version":1,"order":14,"collection":"royal","description":"A crowned royal page with gilded acanthus and courtly engraving.","paperColor":"#ECDCAA","inkColor":"#514125","sealColor":"#826538","ribbonColor":"#AC925B","texture":"parchment","motif":"regal","font":"classic"}',false,true),
 ('preset_ivory_filigree','ivory-filigree','Ivory Filigree','{"version":1,"order":15,"collection":"royal","description":"Ivory linen, intricate scrolling metalwork and a quiet sage seal.","paperColor":"#F6ECCD","inkColor":"#3B4545","sealColor":"#77847C","ribbonColor":"#ABB292","texture":"linen","motif":"gilded","font":"book"}',false,true)
ON CONFLICT ("key") DO UPDATE SET "displayName"=EXCLUDED."displayName", "configJson"=EXCLUDED."configJson";
