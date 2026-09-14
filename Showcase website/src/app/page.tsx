import { Header, Footer } from "@/components/chrome";
import { Hero } from "@/components/hero";
import { WritingTour } from "@/components/writing-tour";
import { Worlds } from "@/components/worlds";
import { Companions } from "@/components/companions";
import { Screenshots } from "@/components/screenshots";
import { Features, QuickGuide, FAQ, DownloadSection, ClosingNote } from "@/components/content";

export default function Home() {
  return <><Header home /><main id="main-content"><Hero /><WritingTour /><Worlds /><Screenshots /><Companions /><Features /><QuickGuide /><FAQ /><DownloadSection /><ClosingNote /></main><Footer /></>;
}
