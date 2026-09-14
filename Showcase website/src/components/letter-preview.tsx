"use client";

import { useId, useRef, useState } from "react";
import { Icon } from "./icons";

export function LetterPreview({ variant = "hero", message = "Somewhere, something wonderful is waiting to find you. Until then, be gentle with your own little corner of the world." }: { variant?: "hero" | "star" | "friend"; message?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const [opened, setOpened] = useState(false);
  function open() { setOpened(true); dialog.current?.showModal(); }
  return <>
    {variant === "hero" ? <button type="button" className={`hero-envelope ${opened ? "was-opened" : ""}`} onClick={open} aria-label="Open a sample letter">
      <span className="envelope-fold" /><span className="wax-seal">L</span><span className="envelope-address">a little note for you</span><span className="envelope-hint">Open me <Icon name="arrow" size={13} /></span>
    </button> : <button type="button" className={variant === "star" ? "sample-star" : "button button-ivory"} onClick={open} aria-label="Open a sample letter">{variant === "star" ? <><Icon name="star" size={24} /><span>Open this little light</span></> : <><Icon name="letter" size={18} />Open a sample letter</>}</button>}
    <dialog ref={dialog} className="letter-dialog" aria-labelledby={title} onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="letter-dialog-inner">
        <button type="button" className="icon-button dialog-close" aria-label="Close sample letter" onClick={() => dialog.current?.close()}><Icon name="close" /></button>
        <Icon name="star" size={30} className="gold-ink" />
        <p className="eyebrow">A SAMPLE FROM OUR STORYBOOK</p>
        <h2 id={title}>Dear you,</h2><p className="letter-message">{message}</p>
        <p className="letter-signature">With a little light, always.</p>
        <span className="sample-note">An imagined letter for this tour. Nothing is sent or saved.</span>
        <button type="button" className="button button-outline" onClick={() => dialog.current?.close()}>Fold it away <Icon name="letter" size={17} /></button>
      </div>
    </dialog>
  </>;
}
