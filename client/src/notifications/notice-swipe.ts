export function isNoticeSwipe(dx: number, dy: number) { return Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.6; }
export function shouldDismissNotice(dx: number, dy: number, vx: number, width: number) {
  return isNoticeSwipe(dx, dy) && (Math.abs(dx) >= Math.min(100, Math.max(55, width * .28)) || Math.abs(dx) > 28 && Math.abs(vx) > .7);
}
