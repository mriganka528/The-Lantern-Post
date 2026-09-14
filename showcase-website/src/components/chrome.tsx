"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "./icons";
import { site } from "@/config/site";

export function Header({ home = false }: { home?: boolean }) {
  const [open, setOpen] = useState(false);
  const anchor = (id: string) => `${home ? "" : "/"}#${id}`;
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  return <header className="site-header">
    <div className="header-inner container">
      <Link className="brand" href="/" aria-label="Lantern Post home">
        <img src="/art/app-icon.webp" width="42" height="42" alt="" />
        <span>Lantern Post<small>A LITTLE LIGHT, ALWAYS</small></span>
      </Link>
      <button className="menu-toggle icon-button" type="button" aria-expanded={open} aria-controls="main-navigation" aria-label={open ? "Close navigation" : "Open navigation"} onClick={() => setOpen(!open)}><Icon name={open ? "close" : "menu"} /></button>
      <nav id="main-navigation" aria-label="Main navigation" className={open ? "navigation is-open" : "navigation"}>
        <a href={anchor("story")} onClick={() => setOpen(false)}>The story</a>
        <a href={anchor("worlds")} onClick={() => setOpen(false)}>The worlds</a>
        <a href={anchor("screenshots")} onClick={() => setOpen(false)}>Inside the app</a>
        <Link href="/guide" onClick={() => setOpen(false)}>A little guide</Link>
        <a href={anchor("download")} className="button button-small" onClick={() => setOpen(false)}><Icon name="download" size={16} />Get the app</a>
      </nav>
    </div>
  </header>;
}

export function Footer() {
  return <footer className="site-footer container">
    <div><Link href="/" className="footer-brand">Lantern Post <Icon name="star" size={18} /></Link><p>{site.tagline}</p></div>
    <nav aria-label="Footer navigation"><Link href="/guide">The field guide</Link><Link href="/privacy">Privacy & your words</Link><Link href="/#download">Download for Android</Link></nav>
    <span className="footer-note">Made for words that matter.<br />For ages 13 and above.</span>
  </footer>;
}
