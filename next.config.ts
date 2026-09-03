import type { NextConfig } from "next";

// ============================================================================
// UNINOTES — Biztonsági HTTP-fejlécek
//
// Az app 100%-ban kliensoldali + opcionális Firebase (Auth + Firestore), így
// a Content-Security-Policy connect-src listáját ehhez a két szolgáltatáshoz
// kell nyitva tartani:
// - identitytoolkit.googleapis.com / securetoken.googleapis.com — email/
//   jelszavas bejelentkezés (lib/auth.ts). NINCS Google-s felugró ablakos
//   OAuth bejelentkezés az appban, ezért frame-src/OAuth popup domain
//   engedélyezésére nincs szükség.
// - firestore.googleapis.com + a *.firebaseio.com WebSocket csatorna — a
//   valós idejű Firestore-szinkron (lib/cloud-sync.ts, onSnapshot).
//
// script-src/style-src 'unsafe-inline': ez a Next.js hivatalos ajánlása
// "nonce nélküli" CSP-hez (lásd node_modules/next/dist/docs/01-app/
// 02-guides/content-security-policy.md → "Without Nonces") — a keretrendszer
// maga is inline <script>/<style> tag(ek)et generál a hidratáláshoz, amit
// enélkül a böngésző blokkolna (kipróbálva: szigorúbb szabállyal a teljes
// alkalmazás fehér lapon ragadt egy React #412 hidratációs hibával). A
// szigorúbb, nonce-alapú változat statikus renderelés helyett minden
// oldalt dinamikussá tenne — ehhez a személyes, egyfelhasználós apphoz nem
// arányos a többletbonyolultság/-terhelés. A tényleges XSS-belépési pontot
// (a jegyzetek Markdown-renderelése) a lib/markdown.ts DOMPurify-
// sanitizálása zárja le; a CSP itt inkább második védelmi vonal: még ha egy
// jövőbeli sérülékenység miatt futna is le idegen script, a connect-src
// akkor is megakadályozná, hogy bármi máshova küldjön adatot, mint a saját
// origin vagy a Firebase.
// ============================================================================

const isDev = process.env.NODE_ENV === "development";

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  // A fejlesztői mód bal alsó sarokban megjelenő "N" jelzője ütközött a
  // Sidebar footer gombjaival (téma váltó, import/export) ugyanabban a
  // sarokban — inkább teljesen kikapcsoljuk. A build/futásidejű hibák
  // ettől függetlenül továbbra is megjelennek.
  devIndicators: false,

  // Ne áruljuk el feleslegesen, hogy Next.js-t futtatunk (kismértékű
  // információ-szivárgás csökkentése).
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          // Clickjacking védelem — a CSP frame-ancestors mellett a régebbi
          // böngészők miatt is érdemes megtartani.
          { key: "X-Frame-Options", value: "DENY" },
          // Ne találgassa a böngésző a Content-Type-ot MIME-sniffelve.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Ne szivárogtassuk a teljes URL-t (pl. jegyzet-azonosítót
          // tartalmazó query paramétert) külső linkek felé.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Az app nem használ kamerát/mikrofont/helymeghatározást — ezeket
          // explicit letiltjuk, hogy egy beágyazott/kompromittált harmadik
          // féltől származó script se kérhesse őket.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
