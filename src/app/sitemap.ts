import type { MetadataRoute } from "next";

const BASE_URL = "https://www.efix-shop.jp";

const PUBLIC_ROUTES = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
  { path: "/order", changeFrequency: "weekly", priority: 0.9 },
  { path: "/coverage", changeFrequency: "weekly", priority: 0.8 },
  { path: "/legal", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PUBLIC_ROUTES.map((route) => ({
    url: `${BASE_URL}${route.path === "/" ? "/" : route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
