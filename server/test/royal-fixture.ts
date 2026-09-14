import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// Exercise the exact additive catalogue migration using isolated test rows.
export function royalFixtures() {
  const sql = readFileSync(resolve(__dirname, '../../prisma/migrations/20260913050000_royal_collection/migration.sql'), 'utf8');
  const characters = [...sql.matchAll(/\('(char_[^']+)','([^']+)','([^']+)','([^']+)',true\)/g)].map(([,id,key,displayName,assetUrl]) => ({ id: id!, key: key!, displayName: displayName!, assetUrl: assetUrl!, isActive: true }));
  const presets = [...sql.matchAll(/\('(preset_[^']+)','([^']+)','([^']+)','(\{[^\n]+\})',false,true\)/g)].map(([,id,key,displayName,config]) => ({ id: id!, key: key!, displayName: displayName!, configJson: JSON.parse(config!) as unknown, isActive: true }));
  return { characters, presets };
}
