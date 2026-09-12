import type { LetterPreset, StationeryConfig } from '@lantern-post/shared-types';

const colors = ['paperColor', 'inkColor', 'sealColor', 'ribbonColor'] as const;

export function serializePreset(row: { id: string; key: string; displayName: string; configJson: unknown }): (LetterPreset & { order: number }) | null {
  const config = row.configJson;
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const value = config as Record<string, unknown>;
  if (value.version !== 1 || typeof value.description !== 'string' || value.description.length > 180 ||
    typeof value.order !== 'number' || !Number.isInteger(value.order) || value.order < 0 || value.order > 100 ||
    colors.some(key => typeof value[key] !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(value[key])) ||
    typeof value.texture !== 'string' || !['parchment', 'linen', 'vellum'].includes(value.texture) ||
    typeof value.motif !== 'string' || !['stars', 'floral', 'royal', 'postmark'].includes(value.motif) ||
    typeof value.font !== 'string' || !['book', 'script', 'classic'].includes(value.font)) return null;
  return {
    id: row.id, key: row.key, displayName: row.displayName, description: value.description, order: value.order,
    config: {
      paperColor: value.paperColor as string, inkColor: value.inkColor as string,
      sealColor: value.sealColor as string, ribbonColor: value.ribbonColor as string,
      texture: value.texture as StationeryConfig['texture'], motif: value.motif as StationeryConfig['motif'], font: value.font as StationeryConfig['font'],
    },
  };
}
