import type { MetadataRoute } from "next";

// ============================================================================
// UNINOTES — Web App Manifest (PWA)
// A Next.js ezt automatikusan `/manifest.webmanifest` alatt szolgálja ki, és
// a <head>-be is beszúrja a <link rel="manifest"> taget — nincs szükség
// kézi public/manifest.json fájlra vagy link tagre.
// ============================================================================

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "UniNotes",
    short_name: "UniNotes",
    description:
      "Lokális, böngészőben tárolt jegyzetelő és félév-szervező alkalmazás egyetemistáknak.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#18181b",
    lang: "hu",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
