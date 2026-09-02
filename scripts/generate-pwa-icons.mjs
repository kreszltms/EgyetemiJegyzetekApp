// Egyszeri, kézzel futtatott generátor script a PWA ikonokhoz — a
// GraduationCap (lucide-react) ikon útvonaladatait használja, ugyanazt,
// amit a Sidebar fejléce is mutat, hogy az app-ikon vizuálisan illeszkedjen.
// Futtatás: node scripts/generate-pwa-icons.mjs
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "icons");
await mkdir(outDir, { recursive: true });

const CAP_PATHS = [
  "M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z",
  "M22 10v6",
  "M6 12.5V16a6 3 0 0 0 12 0v-3.5",
];

// FONTOS: a stroke-width a <g transform="...scale(...)"> ELTOLT/SKÁLÁZOTT
// koordinátarendszerén BELÜL van megadva, tehát az eredeti 24x24-es
// lucide-mértékegységben kell maradnia (ugyanaz a 2, amit a lucide-react is
// használ alapból) — a transform automatikusan felskálázza a végső
// pixelméretre. Ha itt előre felszorozzuk, a vonal a scale-lel MÉGEGYSZER
// megszorzódik, és formátlan folttá hízik.
const LUCIDE_STROKE_WIDTH = 1.8;

function capGroup({ boxSize, canvasSize }) {
  const scale = boxSize / 24;
  const offset = (canvasSize - boxSize) / 2;
  const paths = CAP_PATHS.map((d) => `<path d="${d}"/>`).join("");
  return `<g transform="translate(${offset},${offset}) scale(${scale})" fill="none" stroke="#ffffff" stroke-width="${LUCIDE_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`;
}

const BG = "#18181b";

function svgAny(size) {
  const rx = size * 0.1875; // kb. a Tailwind "rounded-lg" arányai nagyban
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${rx}" fill="${BG}"/>
    ${capGroup({ boxSize: size * 0.586, canvasSize: size })}
  </svg>`;
}

function svgMaskable(size) {
  // Maskable: az OS kör/squircle maszkot vághat rá — az ikon-tartalomnak a
  // biztonságos, kb. középső ~50%-os zónában kell maradnia, a háttér pedig
  // a teljes vásznat kitölti, hogy bármilyen maszk alatt is összefüggő maradjon.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${BG}"/>
    ${capGroup({ boxSize: size * 0.42, canvasSize: size })}
  </svg>`;
}

function svgAppleTouch(size) {
  // iOS maga kerekíti a sarkokat -> teljes, szögletes háttér ("full bleed").
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${BG}"/>
    ${capGroup({ boxSize: size * 0.586, canvasSize: size })}
  </svg>`;
}

const jobs = [
  { name: "icon-192.png", svg: svgAny(192) },
  { name: "icon-512.png", svg: svgAny(512) },
  { name: "icon-maskable-512.png", svg: svgMaskable(512) },
  { name: "apple-touch-icon.png", svg: svgAppleTouch(180) },
];

for (const job of jobs) {
  const buf = await sharp(Buffer.from(job.svg)).png().toBuffer();
  await writeFile(path.join(outDir, job.name), buf);
  console.log("wrote", job.name);
}

// Az "any" 512-es változatot forrás-SVG-ként is elmentjük referenciának.
await writeFile(path.join(outDir, "icon.svg"), svgAny(512));
console.log("done");
