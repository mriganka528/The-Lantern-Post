import type { WorldBounds, WorldStar } from '@lantern-post/shared-types';
import { realmScale, REALM_HEIGHT, REALM_WIDTH } from '../letters/realm-camera';
import type { CameraSnapshot } from '../letters/realm-camera';
export function viewBounds(view: CameraSnapshot): WorldBounds {
  const scale = realmScale(view.width, view.height) * view.zoom;
  return { minX: Math.max(0, Math.floor((REALM_WIDTH / 2 + (-view.width / 2 - view.x) / scale) / 20) * 20), minY: Math.max(0, Math.floor((REALM_HEIGHT / 2 + (-view.height / 2 - view.y) / scale) / 20) * 20),
    maxX: Math.min(REALM_WIDTH, Math.ceil((REALM_WIDTH / 2 + (view.width / 2 - view.x) / scale) / 20) * 20), maxY: Math.min(REALM_HEIGHT, Math.ceil((REALM_HEIGHT / 2 + (view.height / 2 - view.y) / scale) / 20) * 20) };
}
export function projectStar(star: WorldStar, view: CameraSnapshot) { const scale = realmScale(view.width, view.height) * view.zoom; return { x: view.width / 2 + view.x + (star.x - REALM_WIDTH / 2) * scale, y: view.height / 2 + view.y + (star.y - REALM_HEIGHT / 2) * scale }; }
export function starClusters(stars: WorldStar[], view: CameraSnapshot) {
  const groups = new Map<string, { x: number; y: number; stars: WorldStar[] }>(); const seen = new Set<string>();
  for (const star of stars) {
    if (seen.has(star.id)) continue; seen.add(star.id); const point = projectStar(star, view);
    if (point.x < 0 || point.y < 0 || point.x > view.width || point.y > view.height) continue;
    const key = `${Math.floor(point.x / 56)}:${Math.floor(point.y / 56)}`; const group = groups.get(key);
    if (group) { group.x = (group.x * group.stars.length + point.x) / (group.stars.length + 1); group.y = (group.y * group.stars.length + point.y) / (group.stars.length + 1); group.stars.push(star); }
    else groups.set(key, { ...point, stars: [star] });
  }
  return [...groups.entries()].map(([id, group]) => ({ id, ...group }));
}
