/** Edit these two values when the Lantern Post APK release is ready. */
export const download = {
  url: "https://github.com/mriganka528/RollCall/releases/download/v1.0.0/base.apk",
  isTemporary: true,
};

export const site = {
  name: "Lantern Post",
  description: "A fairytale home for your words. Write or record a letter, dress it in antique stationery, and send it to a friend, a sky of stars, or the quiet of the fire.",
  tagline: "Write it. Seal it. Let it go.",
};

export function publicSiteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.origin : undefined;
  } catch { return undefined; }
}
