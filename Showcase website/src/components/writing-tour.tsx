"use client";

import { useState } from "react";
import { Icon } from "./icons";

const chapters = [
  { label: "Find your words", title: "A page, without the pressure.", copy: "Write a passing thought or record up to three minutes of your own voice. Keep several unfinished letters on your desk and come back when the words are ready.", icon: "letter" as const },
  { label: "Make them yours", title: "A little finery for a feeling.", copy: "Choose antique paper, delicate borders, a ribbon and a wax seal. The royal stationery collection is included, so every letter can feel like a keepsake.", icon: "leaf" as const },
  { label: "Seal with care", title: "Let the moment mean something.", copy: "Watch the paper fold, the ribbon settle, and the wax find its place. Sealing keeps your letter with you. It only leaves after you choose a destination and confirm.", icon: "key" as const },
];
const papers = [{ key: "parchment", label: "Lantern parchment" }, { key: "rose", label: "Rose vellum" }, { key: "moon", label: "Moonlit linen" }];

export function WritingTour() {
  const [chapter, setChapter] = useState(0);
  const [paper, setPaper] = useState("parchment");
  const current = chapters[chapter];
  return <section id="story" className="story-section container section-space" aria-labelledby="story-title">
    <div className="section-heading"><p className="eyebrow">LESS SCROLLING. MORE FEELING.</p><h2 id="story-title">A quiet ritual.<br /><em>An entirely different world.</em></h2><p>Part writing sanctuary, part storybook escape. Lantern Post gives everyday thoughts a more beautiful way to be heard — or simply let go.</p></div>
    <div className="writing-tour">
      <div className="writing-tour-controls">
        <div className="chapter-tabs" role="tablist" aria-label="Explore the letter ritual">{chapters.map((item, index) => <button type="button" role="tab" id={`chapter-tab-${index}`} aria-selected={chapter === index} aria-controls="writing-panel" tabIndex={chapter === index ? 0 : -1} key={item.label} onClick={() => setChapter(index)} onKeyDown={event => { if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? 2 : (chapter + (event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 1) + 3) % 3; setChapter(next); document.getElementById(`chapter-tab-${next}`)?.focus(); }}><span>0{index + 1}</span>{item.label}<Icon name="arrow" size={17} /></button>)}</div>
        <div id="writing-panel" role="tabpanel" aria-labelledby={`chapter-tab-${chapter}`} className="chapter-description"><h3>{current.title}</h3><p>{current.copy}</p></div>
        <a href="/guide#first-letter" className="text-link">Your first letter, step by step <Icon name="arrow" size={16} /></a>
      </div>
      <div className={`writing-vignette paper-${paper} ${chapter === 2 ? "is-sealed" : ""}`}>
        <span className="vignette-label">FROM THE PALACE SCRIPTORIUM</span>
        <div className="demo-letter"><div className="demo-letter-border" /><Icon name={current.icon} size={23} /><p className="demo-salutation">Dear a little brighter tomorrow,</p><p>I hope we remember the small things.<br />The warm tea. The kind words.<br />The courage it took to begin again.</p><span className="demo-signature">With hope, always.</span></div>
        <div className="demo-sealed-envelope" aria-hidden={chapter !== 2}><span className="envelope-fold" /><span className="wax-seal">L</span><span>SEALED & STILL YOURS</span></div>
        <img className="desk-companion" src="/art/desk-rabbit-moon.webp" width="255" height="225" alt="A moon rabbit sitting at a candlelit writing desk" loading="lazy" />
        <div className="paper-choices" role="group" aria-label="Preview a stationery colour">{papers.map(item => <button type="button" key={item.key} className={`paper-choice ${item.key}`} aria-label={item.label} aria-pressed={paper === item.key} title={item.label} onClick={() => setPaper(item.key)}>{paper === item.key && <Icon name="check" size={15} />}</button>)}<span>{papers.find(item => item.key === paper)?.label}</span></div>
        <span className="preview-label">A LITTLE PREVIEW OF THE RITUAL</span>
      </div>
    </div>
  </section>;
}
