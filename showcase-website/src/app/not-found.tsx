import Link from "next/link";
import { Header, Footer } from "@/components/chrome";
import { Icon } from "@/components/icons";

export default function NotFound() {
  return <><Header /><main id="main-content" className="not-found container"><Icon name="moon" size={48} /><p className="eyebrow">A LITTLE LOST AMONG THE STARS</p><h1>This path is still<br /><em>being written.</em></h1><p>Let&apos;s take you back to a familiar gate.</p><Link className="button" href="/">Return to Lantern Post <Icon name="arrow" /></Link></main><Footer /></>;
}
