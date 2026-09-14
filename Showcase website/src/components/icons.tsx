import type { CSSProperties, ReactNode } from "react";

export type IconName = "star" | "arrow" | "download" | "moon" | "sun" | "letter" | "key" | "flame" | "voice" | "chat" | "shield" | "leaf" | "check" | "close" | "menu" | "play" | "android" | "book";

export function Icon({ name, size = 20, className = "", style }: { name: IconName; size?: number; className?: string; style?: CSSProperties }) {
  const paths: Record<IconName, ReactNode> = {
    star: <path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7Z" />,
    arrow: <><path d="M4 12h15m-6-6 6 6-6 6" /></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5" /></>,
    moon: <path d="M20.5 14.4A9 9 0 0 1 9.6 3.5a9 9 0 1 0 10.9 10.9Z" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l1.5 1.5m13 13L20 20M4 20l1.5-1.5m13-13L20 4" /></>,
    letter: <><rect x="3" y="5" width="18" height="14" rx="1" /><path d="m4 6 8 7 8-7M4 18l6-6m10 6-6-6" /><circle cx="12" cy="13" r="1.6" /></>,
    key: <><circle cx="7" cy="7" r="4" /><circle cx="7" cy="7" r="1" /><path d="m10 10 10 10m-5-5 3-3m-1 5 3-3" /></>,
    flame: <path d="M13 2c2 7-5 7-2 12 2-1 3-3 3-5 5 4 7 9 3 12-3 2-8 1-10-2-4-6 3-9 6-17Z" />,
    voice: <><rect x="9" y="2" width="6" height="13" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8" /></>,
    chat: <path d="M20 4H4v13h4l4 4v-4h8ZM7 8h10M7 12h6" />,
    shield: <><path d="m12 2 8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5Z" /><path d="m8 11 3 3 5-6" /></>,
    leaf: <><path d="M5 19C1 8 8 3 21 3c0 13-7 20-16 16ZM5 19 17 7M9 15v-5m4 1h5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    play: <path d="m9 5 10 7-10 7Z" />,
    android: <><path d="m7 5-2-3m12 3 2-3M3 14a9 9 0 0 1 18 0v5H3Z" /><circle cx="8" cy="11" r=".6" /><circle cx="16" cy="11" r=".6" /></>,
    book: <><path d="M12 5C8 2 5 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-3-1-6-2-10 1Zm0 0v15" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}>{paths[name]}</svg>;
}

export function Flourish({ className = "" }: { className?: string }) {
  return <div className={`flourish ${className}`} aria-hidden="true"><span /><Icon name="leaf" size={18} /><i>◇</i><Icon name="leaf" size={18} /><span /></div>;
}
