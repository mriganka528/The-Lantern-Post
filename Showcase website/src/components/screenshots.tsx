"use client";

import { useRef, useState } from "react";
import { Icon } from "./icons";

const screens = [
  { file: "palace", title: "Your own little palace", caption: "A companion, a home, and room for all of you." },
  { file: "writing", title: "The writing desk", caption: "Antique paper for the words only you can write." },
  { file: "sealed", title: "A letter, sealed with care", caption: "A little ceremony before the journey begins." },
  { file: "infinity", title: "A sky full of letters", caption: "Find a little light in the night-time Infinity World." },
  { file: "chat", title: "The message parlour", caption: "A familiar voice on the other side of the gate." },
];

export function Screenshots() {
  const rail = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(0);
  const screen = screens[selected];
  const next = (direction: number) => setSelected(value => (value + direction + screens.length) % screens.length);
  function move(direction: number) {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rail.current?.scrollBy({ left: direction * ((rail.current.firstElementChild?.clientWidth ?? 230) + 24), behavior: reduced ? "auto" : "smooth" });
  }
  return <section id="screenshots" className="screenshots-section section-space" aria-labelledby="screenshots-title"><div className="container">
    <div className="screenshots-heading"><div><p className="eyebrow">A FEW PAGES FROM THE PALACE</p><h2 id="screenshots-title">A little look<br /><em>inside the app.</em></h2></div><div><p>The actual screens, from your first gate to a letter among the stars. Tap a preview to take a closer look.</p><div className="screenshot-controls"><button type="button" className="icon-button previous" aria-label="Scroll screenshots left" onClick={() => move(-1)}><Icon name="arrow" size={18} /></button><button type="button" className="icon-button" aria-label="Scroll screenshots right" onClick={() => move(1)}><Icon name="arrow" size={18} /></button></div></div></div>
    <div className="screenshot-rail" ref={rail} aria-label="App screenshot gallery">{screens.map((item, index) => <figure key={item.file}><button type="button" className="screenshot-phone" onClick={() => { setSelected(index); dialog.current?.showModal(); }} aria-label={`Enlarge screenshot: ${item.title}`}><img src={`/screenshots/${item.file}.webp`} width="390" height="844" alt={`${item.title} screen in Lantern Post`} loading="lazy" /><span className="screenshot-zoom"><Icon name="play" size={13} />Take a closer look</span></button><figcaption><span>0{index + 1}</span><div><h3>{item.title}</h3><p>{item.caption}</p></div></figcaption></figure>)}</div>
    <p className="screenshot-source">Actual app previews at phone size, captured with sample content. Swipe or use the arrows to explore.</p>
    <dialog className="screenshot-dialog" ref={dialog} aria-labelledby="screenshot-dialog-title" onKeyDown={event => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); next(event.key === "ArrowRight" ? 1 : -1); } }} onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}><div className="screenshot-dialog-content"><div className="screenshot-dialog-bar"><span className="eyebrow">A CLOSER LOOK · {selected + 1} / {screens.length}</span><button type="button" className="icon-button" aria-label="Close screenshot" onClick={() => dialog.current?.close()}><Icon name="close" /></button></div><img key={screen.file} src={`/screenshots/${screen.file}.webp`} width="390" height="844" alt={`${screen.title} screen in Lantern Post`} /><div className="screenshot-dialog-footer"><button type="button" className="icon-button previous" aria-label="Previous screenshot" onClick={() => next(-1)}><Icon name="arrow" /></button><div aria-live="polite" aria-atomic="true"><h3 id="screenshot-dialog-title">{screen.title}</h3><a href={`/screenshots/${screen.file}.webp`} target="_blank" rel="noopener noreferrer">Open full-size image</a></div><button type="button" className="icon-button" aria-label="Next screenshot" onClick={() => next(1)}><Icon name="arrow" /></button></div></div></dialog>
  </div></section>;
}
