"use client";

import { useState } from "react";
import { Icon, type IconName } from "./icons";
import { LetterPreview } from "./letter-preview";

const worlds: { key: string; name: string; icon: IconName; title: string; description: string; detail: string; image: string; alt: string }[] = [
  { key: "infinity", name: "The Infinity World", icon: "star", title: "A small light.\nAn endless sky.", description: "Release a letter into a shared sky, where it becomes a little star for someone to discover. A stranger's words might be just what your day needed.", detail: "Unsigned by default. Add your username only when you choose to sign.", image: "infinity-night", alt: "A starry sky with floating palaces and moonlit cloud gardens" },
  { key: "friends", name: "A friend's gate", icon: "key", title: "Across the distance.\nRight to their door.", description: "Find one another by username, open your friendship gates, and send something worth keeping. Stay a little longer in the message parlour for a real-time conversation.", detail: "Private letters and conversations between accepted friends.", image: "friendship-court", alt: "An antique palace guestbook surrounded by rose-covered friendship gates" },
  { key: "fire", name: "The Burning World", icon: "flame", title: "For the words\nyou're ready to release.", description: "Some letters don't need a reader. Visit a celestial fire kingdom and watch your confirmed letter slowly turn to embers, ash, and a little more room to breathe.", detail: "Burning is a permanent release. Your recording is never uploaded for a burn.", image: "ember-realm", alt: "A warm celestial fire kingdom with floating temples and a golden altar" },
];

export function Worlds() {
  const [active, setActive] = useState(0);
  const [night, setNight] = useState(true);
  const [burn, setBurn] = useState(false);
  const world = worlds[active];
  return <section id="worlds" className={`worlds-section world-${world.key}`} aria-labelledby="worlds-title">
    <div className="container">
      <div className="worlds-heading"><div><p className="eyebrow">THREE PATHS BEYOND THE PALACE</p><h2 id="worlds-title">Where will your<br /><em>words wander?</em></h2></div><p>There is a place for every kind of letter.<br />You choose the journey. Every time.</p></div>
      <div className="world-tabs" role="tablist" aria-label="Explore a destination">{worlds.map((item, index) => <button key={item.key} type="button" role="tab" id={`world-tab-${index}`} aria-selected={active === index} tabIndex={active === index ? 0 : -1} aria-controls="world-panel" onClick={() => { setActive(index); setBurn(false); }} onKeyDown={event => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? 2 : (active + (event.key === "ArrowLeft" ? -1 : 1) + 3) % 3; setActive(next); setBurn(false); document.getElementById(`world-tab-${next}`)?.focus(); }}><Icon name={item.icon} size={18} />{item.name}</button>)}</div>
      <div id="world-panel" role="tabpanel" aria-labelledby={`world-tab-${active}`} className="world-panel">
        <div className="world-copy"><span className="world-number">0{active + 1} / THE JOURNEY</span><h3>{world.title.split("\n").map((line, index) => <span key={index}>{line}<br /></span>)}</h3><p>{world.description}</p><div className="world-detail"><Icon name={world.icon} size={18} /><span>{world.detail}</span></div><a href="/guide#destinations" className="text-link">Read the field guide <Icon name="arrow" size={17} /></a></div>
        <div className={`world-scene ${active === 0 && !night ? "is-day" : ""}`}>
          <img src={`/art/${active === 0 && !night ? "infinity-day" : world.image}.webp`} alt={active === 0 && !night ? "The Infinity World in soft daylight, with ivory palaces and lilac clouds" : world.alt} width="1200" height="750" loading="lazy" />
          {active === 0 && <><div className="sky-switch" role="group" aria-label="Preview time of day"><button type="button" aria-pressed={night} onClick={() => setNight(true)}><Icon name="moon" size={14} />Night</button><button type="button" aria-pressed={!night} onClick={() => setNight(false)}><Icon name="sun" size={14} />Day</button></div><LetterPreview variant="star" /></>}
          {active === 1 && <div className="friend-sample"><LetterPreview variant="friend" message="I saw something small and lovely today, and thought of you. That is all. Just a little reminder that you are part of my world, even from far away." /></div>}
          {active === 2 && <div className={`fire-sample ${burn ? "is-burning" : ""}`}><div className="fire-paper" aria-hidden="true"><Icon name="letter" size={35} /></div><span className="fire-embers" aria-hidden="true">✦ · ✧ · ✦</span><button type="button" className="button button-ivory" onClick={() => setBurn(!burn)}><Icon name="flame" size={16} />{burn ? "Begin the preview again" : "Preview a little release"}</button><span role="status">{burn ? "Some words can rest now." : "An imagined letter, just for this tour."}</span></div>}
          <span className="world-preview-note">A WINDOW INTO THE WORLD · INTERACTIVE PREVIEW</span>
        </div>
      </div>
    </div>
  </section>;
}
