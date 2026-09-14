"use client";

import { useState } from "react";
import { Icon } from "./icons";

const companions = [
  { key: "rabbit-moon", name: "Lune", title: "The dreamer in the garden", palace: "The Moonflower Palace", line: "For the midnight thinkers and the quietly hopeful. A moon rabbit, a silver-lilac palace, and a place to let your thoughts bloom." },
  { key: "fox-lantern", name: "Ember", title: "A little keeper of light", palace: "The Amber Palace", line: "For warm hearts and brave little beginnings. Follow a lantern fox through honey-coloured stone and the soft glow of home." },
  { key: "owl-scholar", name: "Orion", title: "A friend for every chapter", palace: "The Starlight Library", line: "For old souls, book lovers, and stories that take their time. A thoughtful owl keeps you company beneath a sky of stars." },
  { key: "deer-dawn", name: "Flora", title: "Where gentle things grow", palace: "The Rosewood Palace", line: "For fresh starts and tender words. A dawn deer leads the way through rose-covered arches and a little morning light." },
  { key: "cat-astral", name: "Celeste", title: "A wanderer among the stars", palace: "The Astral Palace", line: "For the curious and the wonderfully wistful. An astral cat awaits in a violet observatory, where the sky feels close enough to touch." },
  { key: "swan-cloud", name: "Sol", title: "A quiet kind of grace", palace: "The Cloud Palace", line: "For the letters written softly. A cloud swan welcomes you into pearl halls, mint gardens, and a world with room to breathe." },
  { key: "unicorn-aurelia", name: "Aurelia", title: "A little opal-coloured wonder", palace: "Aurelia's royal palace", line: "For a touch of the extraordinary. An opal unicorn, delicate gilding, and a palace worthy of your most treasured words." },
  { key: "peacock-seraph", name: "Seraph", title: "Colour, with a little ceremony", palace: "Seraph's royal palace", line: "For the wonderfully expressive. A jewelled peacock brings deep teal, antique gold, and a little grandeur to the everyday." },
  { key: "lion-solstice", name: "Aurel", title: "A warm and courageous heart", palace: "Aurel's royal palace", line: "For words that take a little courage. A crowned lion and a sun-warmed palace make a home for your next beginning." },
  { key: "dragon-jade", name: "Jade", title: "A story waiting to unfold", palace: "Jade's royal palace", line: "For the dreamers of faraway places. A gentle jade dragon walks beside you through carved arches and quiet green gardens." },
];

export function Companions() {
  const [selected, setSelected] = useState(0);
  const companion = companions[selected];
  return <section id="companions" className="companions-section container section-space" aria-labelledby="companions-title">
    <div className="companion-portrait"><div className="portrait-arch"><img className="portrait-palace" src={`/art/palace-${companion.key}.webp`} alt="" width="1000" height="550" loading="lazy" /><div className="portrait-halo" /><img key={companion.key} className="portrait-character" src={`/art/character-${companion.key}.webp`} width="320" height="359" alt={`${companion.name}, your storybook companion`} loading="lazy" /></div><div className="portrait-plaque"><Icon name="star" size={14} /><span>{companion.palace}</span><Icon name="star" size={14} /></div><span className="portrait-side-note">A FRIEND FOR THE JOURNEY</span></div>
    <div className="companion-copy"><p className="eyebrow">YOUR PALACE. YOUR LITTLE COMPANION.</p><h2 id="companions-title">Never quite<br /><em>writing alone.</em></h2><p>Choose a character who feels a little like you. They&apos;ll welcome you home, keep you company at the desk, and walk your letters through the gates.</p>
      <div className="companion-description" aria-live="polite" aria-atomic="true"><h3>{companion.name} <span>{companion.title}</span></h3><p>{companion.line}</p></div>
      <div className="companion-picker" role="group" aria-label="Meet the ten companions">{companions.map((item, index) => <button key={item.key} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}><img src={`/art/character-${item.key}.webp`} width="48" height="54" alt="" loading="lazy" /><span>{item.name}</span></button>)}</div>
      <span className="collection-note"><Icon name="check" size={15} />All ten companions, including the Royal Collection, are free for now.</span>
    </div>
  </section>;
}
