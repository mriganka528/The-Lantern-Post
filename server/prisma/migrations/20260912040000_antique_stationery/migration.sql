-- Age the existing six papers without replacing IDs or activation settings.
UPDATE "Preset" SET "configJson" = "configJson" || CASE "key"
  WHEN 'lantern-parchment' THEN '{"paperColor":"#F0DDB5","inkColor":"#493622","sealColor":"#874B36","ribbonColor":"#899069","description":"Weathered parchment, an antique postmark, and a lantern seal."}'::jsonb
  WHEN 'moonflower' THEN '{"paperColor":"#E7E0CF","inkColor":"#4F4855","sealColor":"#7A697F","ribbonColor":"#A299AD","description":"Moon-aged vellum from the palace observatory, edged with stars."}'::jsonb
  WHEN 'rose-and-ribbon' THEN '{"paperColor":"#EBD4BC","inkColor":"#674539","sealColor":"#985962","ribbonColor":"#AD8380","description":"Rose-tinted linen, pressed-flower borders, and a faded silk ribbon."}'::jsonb
  WHEN 'celestial-vellum' THEN '{"paperColor":"#DDDCCE","inkColor":"#42535B","sealColor":"#5B7480","ribbonColor":"#B19860","description":"An old celestial chart, pale blue ink, and a seal of evening sky."}'::jsonb
  WHEN 'meadow-linen' THEN '{"paperColor":"#E0DFC3","inkColor":"#4B513C","sealColor":"#647852","ribbonColor":"#98A078","description":"Handwoven garden linen with a delicate botanical engraving."}'::jsonb
  WHEN 'royal-ivory' THEN '{"paperColor":"#F3E4BE","inkColor":"#493720","sealColor":"#713D43","ribbonColor":"#B1934F","description":"Royal correspondence: aged ivory, gilded flourishes, and burgundy wax."}'::jsonb
END
WHERE "key" IN ('lantern-parchment', 'moonflower', 'rose-and-ribbon', 'celestial-vellum', 'meadow-linen', 'royal-ivory')
  AND "configJson"->>'version' = '1';
