import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const url = publicSiteUrl();
  return url ? ["", "/guide", "/privacy"].map(path => ({ url: url + path, changeFrequency: "monthly", priority: path ? .6 : 1 })) : [];
}
