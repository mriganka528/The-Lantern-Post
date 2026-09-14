import { Icon } from "./icons";
import { LetterPreview } from "./letter-preview";

export function Hero() {
  return <section className="hero container" aria-labelledby="hero-title">
    <div className="hero-copy">
      <p className="eyebrow hero-eyebrow"><span /> A LITTLE WORLD FOR YOUR WORDS</p>
      <h1 id="hero-title">Some words<br />need a little <em>magic.</em></h1>
      <p className="hero-description">The thought you never sent. The friend you miss. The feeling you&apos;re ready to let go.</p>
      <p className="hero-description hero-description-last">Give them a home in Lantern Post — a fairytale world of letters, friendship, and little new beginnings.</p>
      <div className="hero-actions"><a href="#download" className="button"><Icon name="android" />Find your little world <Icon name="arrow" size={18} /></a><a href="#story" className="quiet-link"><span className="play-ring"><Icon name="play" size={13} /></span>Step inside the story</a></div>
      <div className="hero-footnote"><Icon name="leaf" size={16} /><span>Free to begin. A little slower. A little more meaningful.</span></div>
    </div>
    <div className="hero-visual">
      <span className="hero-orbit orbit-one" aria-hidden="true" /><span className="hero-orbit orbit-two" aria-hidden="true" />
      <Icon name="star" className="hero-spark spark-one" size={28} /><Icon name="star" className="hero-spark spark-two" size={15} />
      <div className="hero-arch"><img src="/art/infinity-night.webp" alt="A moonlit fairytale palace above a river of clouds" width="1200" height="750" fetchPriority="high" /><div className="arch-stars" aria-hidden="true">✦<span>✧</span><i>✦</i></div><span className="arch-caption">BEYOND THE ORDINARY</span></div>
      <div className="hero-paper-note"><Icon name="moon" size={17} /><span>A place to leave<br />a little light.</span></div>
      <LetterPreview />
      <div className="hero-companion"><img src="/art/character-rabbit-moon.webp" alt="Lune, the moon rabbit companion" width="150" height="169" /><span>Someone to walk<br /><em>beside you.</em></span></div>
      <span className="hero-side-caption">YOUR STORY STARTS AT THE GATE</span>
    </div>
    <div className="hero-bottom"><span>WRITE IT</span><Icon name="star" size={12} /><span>SEAL IT</span><Icon name="star" size={12} /><span>LET IT GO</span><a href="#story" aria-label="Scroll to the story"><Icon name="arrow" size={20} /></a></div>
  </section>;
}
