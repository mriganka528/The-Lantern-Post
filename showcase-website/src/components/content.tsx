import Link from "next/link";
import { download } from "@/config/site";
import { Flourish, Icon, type IconName } from "./icons";

const features: { icon: IconName; title: string; text: string }[] = [
  { icon: "voice", title: "Words, or your own voice", text: "Write a letter or leave a recording of up to three minutes. A little more personal, in whatever way feels right." },
  { icon: "chat", title: "A parlour for your people", text: "Share your username, invite a friend, and talk in real time. Your own little corner of conversation." },
  { icon: "letter", title: "Room for unfinished thoughts", text: "Keep several letters on your desk. Return to a draft, remove one, or share a copy through your favourite app." },
  { icon: "shield", title: "Keep what matters to you", text: "Create encrypted chat and voice keepsake backups locally or in your connected Google Drive. Keep your recovery key safe." },
  { icon: "moon", title: "Magic at your own pace", text: "Choose day or night in the Infinity World. Pause the motion, skip a ceremony, or take your time exploring." },
  { icon: "key", title: "Your gates, your choices", text: "Decide where each letter goes. Arrival bells, notification controls, blocking, and reporting are always close by." },
];

export function Features() {
  return <section className="features-section container section-space" aria-labelledby="features-title"><div className="features-heading"><div><p className="eyebrow">THOUGHTFUL LITTLE DETAILS</p><h2 id="features-title">A little more than<br /><em>a letter.</em></h2></div><p>Everything has a place. Your voice, your friends, your half-finished thoughts — and the things you want to keep.</p></div><div className="feature-grid">{features.map((feature, index) => <article key={feature.title}><span className="feature-number">0{index + 1}</span><Icon name={feature.icon} size={26} /><h3>{feature.title}</h3><p>{feature.text}</p></article>)}</div></section>;
}

export function QuickGuide() {
  return <section className="quick-guide section-space" aria-labelledby="guide-title"><div className="container"><div className="section-heading"><p className="eyebrow">YOUR FIRST LITTLE ADVENTURE</p><h2 id="guide-title">From your pocket<br /><em>to a palace.</em></h2></div><ol className="guide-steps"><li><span>01</span><h3>Come on in</h3><p>Install the Android APK, open Lantern Post, and sign in. Choose a public username to help friends find you.</p></li><li><span>02</span><h3>Find your familiar</h3><p>Meet the companions and choose yours. Their palace becomes your own quiet corner of the world.</p></li><li><span>03</span><h3>Leave a little light</h3><p>Write or record, choose your stationery, and seal your letter. Pick a destination when you&apos;re ready.</p></li></ol><Link className="text-link guide-link" href="/guide"><Icon name="book" size={18} />The complete field guide <Icon name="arrow" size={17} /></Link></div></section>;
}

const questions = [
  ["What exactly is Lantern Post?", "It is a fairytale letter-writing app with a personal palace, storybook companions, private letters, voice recordings, and real-time chat with accepted friends. You can also release a letter into the shared Infinity World or let it go through a burning ritual."],
  ["Is it free to use?", "The current app features, stationery presets, and all ten companions — including the Royal Collection — are free for now. The showcase website does not ask for payment or a card."],
  ["Who can see my letters?", "Unsent drafts stay on your device. A friend letter goes to the accepted friend you choose. Infinity letters can be read by signed-in community members and are unsigned unless you choose to sign them. The service still knows the author; unsigned does not mean anonymous to the service."],
  ["Does sealing a letter send it?", "No. Sealing folds and decorates the letter, but it stays with you. Sending, publishing, and burning each need a separate destination choice and confirmation."],
  ["Can I get a burned letter back?", "A confirmed burn permanently releases the letter. It is not a backup or an archive. Burning cannot recall any copies you previously shared or exported, so only burn when you are ready."],
  ["Will my drafts survive reinstalling?", "Local drafts and recordings can be lost when you uninstall or clear the app's data. Optional encrypted voice keepsakes and chat archives can be saved locally or to your connected Google Drive. Keep the recovery key separately; restoration opens an archive, not a replay of messages or a full restore of every draft."],
  ["Is there an iPhone download?", "This website currently offers an Android APK link only. There is no iPhone download here. Android installation help is in the field guide."],
];

export function FAQ() {
  return <section className="faq-section container section-space" aria-labelledby="faq-title"><div><p className="eyebrow">A FEW THINGS YOU MAY WONDER</p><h2 id="faq-title">Before you<br /><em>open the gate.</em></h2><p>A few answers for the curious.<br />There is more in the <Link href="/guide">field guide</Link>.</p></div><div className="faq-list">{questions.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>;
}

export function DownloadSection() {
  return <section id="download" className="download-section container" aria-labelledby="download-title"><div className="download-ornament" aria-hidden="true"><Icon name="star" size={110} /></div><div className="download-heading"><img src="/art/app-icon.webp" alt="Lantern Post's glowing lantern and sealed letter app icon" width="88" height="88" loading="lazy" /><div><p className="eyebrow">YOUR LITTLE WORLD IS WAITING</p><h2 id="download-title">Take a little<br /><em>magic with you.</em></h2></div></div><div className="download-actions"><a className="button button-download" href={download.url} target="_blank" rel="noopener noreferrer"><Icon name="android" size={23} /><span>Download for Android<small>ANDROID APK{download.isTemporary ? " · PREVIEW LINK" : ""}</small></span><Icon name="download" size={22} /></a><Link className="text-link" href="/guide#install">A little help installing <Icon name="arrow" size={16} /></Link>{download.isTemporary && <p className="download-notice">This is a temporary GitHub download link. The Lantern Post APK will replace it here.</p>}</div></section>;
}

export function ClosingNote() {
  return <div className="closing-note container"><Flourish /><p>Some things are lighter<br />when you <em>let them go.</em></p><span>WITH A LITTLE LIGHT, ALWAYS.</span></div>;
}
