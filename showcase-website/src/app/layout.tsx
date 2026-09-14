import type { Metadata, Viewport } from "next";
import { site, publicSiteUrl } from "@/config/site";
import "./globals.css";

const url = publicSiteUrl();
export const metadata: Metadata = {
  title: { default: "Lantern Post — A little world for your words", template: "%s · Lantern Post" },
  description: site.description,
  applicationName: site.name,
  ...(url ? { metadataBase: new URL(url) } : {}),
  openGraph: { type: "website", locale: "en_US", siteName: site.name, title: "Some words need a little magic.", description: site.description, ...(url ? { url, images: [{ url: `${url}/art/social-card.webp`, width: 1200, height: 630, alt: "Lantern Post — Write it. Seal it. Let it go." }] } : {}) },
  twitter: { card: "summary_large_image", title: "Lantern Post", description: site.description, ...(url ? { images: [`${url}/art/social-card.webp`] } : {}) },
  icons: { icon: "/icon.png", apple: "/apple-icon.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f8f4ea" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to content</a>{children}</body></html>;
}
