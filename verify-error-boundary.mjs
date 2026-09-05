import { chromium } from "playwright";

// ============================================================================
// UNINOTES — Hiba-elkapó képernyő (app/error.tsx) verifikáció
//
// A jegyzet-alkalmazás komponensfájában szándékosan bekötött teszt-hiba
// (lásd AppShell.tsx VERIFIKÁCIÓS PATCH, ?verify_crash=1 az URL-ben — amíg
// ez a paraméter jelen van, MINDEN render dob, hogy túlélje a React 18+
// beépített, egyszeri automatikus render-újrapróbálását) alapján
// ellenőrzi, hogy:
//   1) a natív/angol Next.js hibaoldal helyett a magyar app/error.tsx jelenik
//      meg,
//   2) a "Biztonsági mentés letöltése" gomb a hiba ELLENÉRE is egy érvényes,
//      a ténylegesen elmentett jegyzetet tartalmazó JSON fájlt tölt le
//      (bizonyítva, hogy az adatok nem a React-fa memóriájában élnek), és
//   3) az "Újrapróbálás" gombra kattintva — ha a hiba oka időközben elmúlt —
//      az app ténylegesen visszaáll a normál nézetre.
// ============================================================================

const state = {
  state: {
    semesters: [
      { id: "sem-c", nev: "2026/27/1 (Aktuális félév)", aktiv: true, archivalt: false, createdAt: "2026-09-01T00:00:00.000Z" },
    ],
    subjects: [
      {
        id: "s1", semesterId: "sem-c", nev: "Hibakezelés Teszt Tárgy", kod: "HIBA1", szin: "#22c55e", ikon: "Code2",
        oktato: { nev: "", email: "", fogadoora: "" },
        hianyzas: { maxHianyzas: 3, jelenlegiHianyzas: 0 }, kovetelmenyek: [],
        kredit: 5,
        createdAt: "2026-09-05T00:00:00.000Z", updatedAt: "2026-09-05T00:00:00.000Z",
      },
    ],
    notes: [
      {
        id: "n1", subjectId: "s1", cim: "Hiba-elkapó teszt jegyzet — ne vesszen el", tipus: "eloadas", datum: "2026-09-05",
        tartalom: "Ez a jegyzet a mentés/visszaállítás ellenőrzésére szolgál.",
        cimkek: [], mellekletek: [],
        createdAt: "2026-09-05T00:00:00.000Z", updatedAt: "2026-09-05T00:00:00.000Z",
      },
    ],
    scheduleEvents: [],
  },
  version: 1,
};

const results = [];
function check(name, cond, extra) {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}${extra ? " :: " + extra : ""}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
page.on("pageerror", () => {
  // Elvárt: a szándékos teszt-hiba MAGA egy pageerror-t generálna, ha nem
  // kapná el az error boundary. Itt nem logoljuk hibaként, mert pontosan
  // ennek a viselkedésnek a hiányát (elkapott hiba) teszteljük lent.
});
page.on("console", (msg) => {
  if (msg.type() === "error" && !msg.text().includes("Szándékos teszt-hiba")) {
    console.log("CONSOLE ERROR:", msg.text());
  }
});

// --- Előkészítés: állapot beültetése, crash-jelző törlése -------------------
await page.goto("http://localhost:3411", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("egyetemi-jegyzetek-storage", JSON.stringify(s)), state);
await page.evaluate(() => {
  localStorage.setItem("theme", "dark");
});

// --- 1) Navigálás a hibát kiváltó URL-re -----------------------------------
await page.goto("http://localhost:3411/?verify_crash=1", { waitUntil: "networkidle" });
await page.waitForTimeout(300);

const errorHeading = page.getByRole("heading", { name: "Váratlan hiba történt" });
check("A magyar hiba-elkapó képernyő megjelenik", (await errorHeading.count()) > 0);

const normalAppMarker = page.locator("text=Tárgyaid");
check(
  "A normál app-felület NEM látszik a hibaképernyő alatt (a hiba tényleg elkapva, nem csak melléje renderelve)",
  (await normalAppMarker.count()) === 0
);

const retryButton = page.getByRole("button", { name: "Újrapróbálás" });
const reloadButton = page.getByRole("button", { name: "Teljes újratöltés" });
const backupButton = page.getByRole("button", { name: "Biztonsági mentés letöltése" });
check("Az 'Újrapróbálás' gomb megjelenik", (await retryButton.count()) > 0);
check("A 'Teljes újratöltés' gomb megjelenik", (await reloadButton.count()) > 0);
check("A 'Biztonsági mentés letöltése' gomb megjelenik", (await backupButton.count()) > 0);

// --- 2) Biztonsági mentés a hibaképernyőről is működik ----------------------
const [download] = await Promise.all([
  page.waitForEvent("download"),
  backupButton.click(),
]);
const downloadPath = await download.path();
const fs = await import("node:fs/promises");
const content = downloadPath ? await fs.readFile(downloadPath, "utf8") : "";
let backupJson = null;
try {
  backupJson = JSON.parse(content);
} catch {
  backupJson = null;
}
check(
  "A hibaképernyőről letöltött mentés érvényes JSON, és tartalmazza a ténylegesen elmentett jegyzetet",
  Boolean(
    backupJson &&
      Array.isArray(backupJson.notes) &&
      backupJson.notes.some((n) => n.cim === "Hiba-elkapó teszt jegyzet — ne vesszen el")
  ),
  download.suggestedFilename()
);

// --- 3) "Újrapróbálás" -> a hiba oka (a ?verify_crash=1 paraméter) most már
// elmúlt, helyreáll az app. A paramétert navigáció NÉLKÜL (history API-val)
// távolítjuk el, mielőtt megnyomjuk a gombot — ezzel szimuláljuk, hogy a
// hibát okozó állapot (pl. egy sérült adat) időközben megszűnt, és a
// reset() valóban egy IMMÁR SIKERES render-kísérletet indít.
await page.evaluate(() => window.history.replaceState(null, "", "/"));
await retryButton.click();
await page.waitForTimeout(500);

const errorHeadingAfterRetry = page.getByRole("heading", { name: "Váratlan hiba történt" });
check(
  "Újrapróbálás után a hibaképernyő ELTŰNIK",
  (await errorHeadingAfterRetry.count()) === 0
);
const recoveredAppMarker = page.locator("text=Tárgyaid");
check(
  "Újrapróbálás után a normál app-felület (Kezdőlap) megjelenik",
  (await recoveredAppMarker.count()) > 0
);

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length > 0) process.exit(1);
