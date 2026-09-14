import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PropsWithChildren } from 'react';
import type { RealmCamera, Point } from './realm-camera';

export interface RealmViewportProps { camera: RealmCamera; height: number; interactive?: boolean; label?: string; }

export function RealmViewport({ camera, height, children, interactive = false, label = 'Explore the Burning World. Drag to pan, pinch or use plus and minus to zoom. Arrow keys pan; zero resets.' }: PropsWithChildren<RealmViewportProps>) {
  const element = useRef<HTMLDivElement>(null);
  const [pointers] = useState(() => new Map<number, Point>());
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const resize = () => camera.resize(node.clientWidth, node.clientHeight);
    const observer = new ResizeObserver(resize); observer.observe(node); resize();
    const wheel = (event: WheelEvent) => {
      // A trackpad pinch emits Ctrl+wheel. Ordinary scrolling still scrolls
      // the page; focused inspection also accepts an ordinary mouse wheel.
      if (!event.ctrlKey && !event.metaKey && document.activeElement !== node) return;
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      const zoom = camera.getSnapshot().zoom * Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * .006);
      camera.zoomTo(zoom, { x: event.clientX - rect.left, y: event.clientY - rect.top }, false);
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => { observer.disconnect(); node.removeEventListener('wheel', wheel); camera.end(); pointers.clear(); };
  }, [camera, pointers]);
  const position = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const end = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.delete(event.pointerId);
    if (pointers.size) camera.begin([...pointers.values()]); else { camera.end(); setDragging(false); }
  };
  const style: CSSProperties = { position: 'relative', width: '100%', height, overflow: 'hidden', background: '#211B27', border: '1px solid #A98B56', borderRadius: 7, touchAction: 'none', userSelect: 'none', cursor: dragging ? 'grabbing' : 'grab', outlineColor: '#C9A76A', boxSizing: 'border-box' };
  return <div ref={element} data-testid="realm-viewport" role="region" aria-label={label} tabIndex={0} style={style}
    onPointerDown={event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (interactive && (event.target as HTMLElement).closest('button,[role="button"]')) return;
      event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, position(event)); camera.begin([...pointers.values()]); setDragging(true);
    }}
    onPointerMove={event => { if (pointers.has(event.pointerId)) { pointers.set(event.pointerId, position(event)); camera.move([...pointers.values()]); } }}
    onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
    onKeyDown={event => {
      if (interactive && event.target !== event.currentTarget) return;
      const key = event.key;
      if (['+', '=', '-', '0', 'Home', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) event.preventDefault();
      if (key === '+' || key === '=') camera.zoomBy(.25);
      else if (key === '-') camera.zoomBy(-.25);
      else if (key === '0' || key === 'Home') camera.reset();
      else if (key === 'ArrowLeft') camera.panBy(60, 0);
      else if (key === 'ArrowRight') camera.panBy(-60, 0);
      else if (key === 'ArrowUp') camera.panBy(0, 60);
      else if (key === 'ArrowDown') camera.panBy(0, -60);
    }}>
    <div style={{ position: 'absolute', inset: 0, pointerEvents: interactive ? 'auto' : 'none' }} aria-hidden={interactive ? undefined : true}>{children}</div>
  </div>;
}
