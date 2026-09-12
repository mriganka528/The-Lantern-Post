export const REALM_WIDTH = 1600;
export const REALM_HEIGHT = 1000;
export const MIN_REALM_ZOOM = 1;
export const MAX_REALM_ZOOM = 3;

export interface Point { x: number; y: number; }
export interface CameraPose { zoom: number; x: number; y: number; }
export interface CameraSnapshot extends CameraPose { width: number; height: number; animate: boolean; }
export const realmScale = (width: number, height: number) => Math.max(width / REALM_WIDTH, height / REALM_HEIGHT);

export function clampCamera(pose: CameraPose, width: number, height: number): CameraPose {
  const zoom = Math.min(MAX_REALM_ZOOM, Math.max(MIN_REALM_ZOOM, Number.isFinite(pose.zoom) ? pose.zoom : 1));
  const scale = realmScale(width, height) * zoom;
  const maxX = Math.max(0, (REALM_WIDTH * scale - width) / 2);
  const maxY = Math.max(0, (REALM_HEIGHT * scale - height) / 2);
  return { zoom, x: Math.min(maxX, Math.max(-maxX, Number.isFinite(pose.x) ? pose.x : 0)), y: Math.min(maxY, Math.max(-maxY, Number.isFinite(pose.y) ? pose.y : 0)) };
}

export function zoomAt(pose: CameraPose, zoom: number, anchor: Point, width: number, height: number): CameraPose {
  const nextZoom = clampCamera({ ...pose, zoom }, width, height).zoom;
  const ratio = nextZoom / pose.zoom;
  const ax = anchor.x - width / 2; const ay = anchor.y - height / 2;
  return clampCamera({ zoom: nextZoom, x: ax - (ax - pose.x) * ratio, y: ay - (ay - pose.y) * ratio }, width, height);
}

export function pinchCamera(pose: CameraPose, start: readonly Point[], current: readonly Point[], width: number, height: number): CameraPose {
  const [a, b] = start; const [c, d] = current;
  if (!a || !b || !c || !d) return pose;
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  if (distance < 2) return pose;
  const ratio = Math.hypot(d.x - c.x, d.y - c.y) / distance;
  const startMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const mid = { x: (c.x + d.x) / 2, y: (c.y + d.y) / 2 };
  const unclampedZoom = Math.min(MAX_REALM_ZOOM, Math.max(MIN_REALM_ZOOM, pose.zoom * ratio));
  const actualRatio = unclampedZoom / pose.zoom;
  return clampCamera({ zoom: unclampedZoom,
    x: mid.x - width / 2 - (startMid.x - width / 2 - pose.x) * actualRatio,
    y: mid.y - height / 2 - (startMid.y - height / 2 - pose.y) * actualRatio,
  }, width, height);
}

// Shared by touch, pointer, wheel, and keyboard controls. No animation or
// release state lives here: inspecting the realm can never submit a letter.
export class RealmCamera {
  private state: CameraSnapshot = { width: 1, height: 1, zoom: 1, x: 0, y: 0, animate: false };
  private listeners = new Set<() => void>();
  private gesture: { pose: CameraPose; points: Point[] } | null = null;
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private set(pose: CameraPose, animate = false) {
    this.state = { ...this.state, ...clampCamera(pose, this.state.width, this.state.height), animate };
    this.listeners.forEach(listener => listener());
  }
  resize(width: number, height: number) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || !(width > 0 && height > 0) || (width === this.state.width && height === this.state.height)) return;
    const ratio = this.state.width > 1 ? realmScale(width, height) / realmScale(this.state.width, this.state.height) : 1;
    this.state = { ...this.state, width, height };
    this.set({ ...this.state, x: this.state.x * ratio, y: this.state.y * ratio });
    this.gesture = null;
  }
  zoomTo(zoom: number, anchor = { x: this.state.width / 2, y: this.state.height / 2 }, animate = true) {
    this.gesture = null;
    this.set(zoomAt(this.state, zoom, anchor, this.state.width, this.state.height), animate);
  }
  zoomBy(amount: number) { this.zoomTo(this.state.zoom + amount); }
  panBy(x: number, y: number) { this.set({ ...this.state, x: this.state.x + x, y: this.state.y + y }); }
  reset() { this.gesture = null; this.set({ zoom: 1, x: 0, y: 0 }, true); }
  focus(point: Point, zoom = 2.2) {
    this.gesture = null;
    const scale = realmScale(this.state.width, this.state.height) * zoom;
    this.set({ zoom, x: (REALM_WIDTH / 2 - point.x) * scale, y: (REALM_HEIGHT / 2 - point.y) * scale }, true);
  }
  begin(points: readonly Point[]) { this.gesture = { pose: this.state, points: points.slice(0, 2).map(p => ({ ...p })) }; }
  move(points: readonly Point[]) {
    if (!this.gesture || points.length === 0) return;
    if (Math.min(points.length, 2) !== this.gesture.points.length) { this.begin(points); return; }
    if (points.length >= 2) this.set(pinchCamera(this.gesture.pose, this.gesture.points, points, this.state.width, this.state.height));
    else if (points[0] && this.gesture.points[0]) this.set({ ...this.gesture.pose, x: this.gesture.pose.x + points[0].x - this.gesture.points[0].x, y: this.gesture.pose.y + points[0].y - this.gesture.points[0].y });
  }
  end() { this.gesture = null; }
}
