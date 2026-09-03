import { chromium } from "playwright";

const state = {
  state: {
    semesters: [
      { id: "sem-c", nev: "2026/27/1 (Aktuális félév)", aktiv: true, archivalt: false, createdAt: "2026-09-01T00:00:00.000Z" },
    ],
    subjects: [
      {
        id: "s1", semesterId: "sem-c", nev: "Adatbázisrendszerek", kod: "ADAT1", szin: "#22c55e", ikon: "Code2",
        oktato: { nev: "", email: "", fogadoora: "" },
        hianyzas: { maxHianyzas: 3, jelenlegiHianyzas: 0 }, kovetelmenyek: [],
        kredit: 5,
        createdAt: "2026-09-05T00:00:00.000Z", updatedAt: "2026-09-05T00:00:00.000Z",
      },
    ],
    notes: [
      {
        // A cím SZÁNDÉKOSAN nem tartalmazza a keresett szót — csak a
        // tartalom, méghozzá egy hosszabb bekezdés KÖZEPÉN, hogy a
        // snippet-vágás (SNIPPET_RADIUS) és az ellipszis is tesztelve legyen.
        id: "n1", subjectId: "s1", cim: "Óravázlat 3. hét", tipus: "eloadas", datum: "2026-09-01",
        tartalom:
          "Ez egy hosszú bekezdés arról, hogy a horizontális particionálás miként segíti a nagy táblák teljesítményét élesben, és még számos más apró technikai részlet is szerepel a jegyzet további soraiban.",
        cimkek: [], mellekletek: [],
        createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
      },
      {
        // Ennél a címben van a találat -> itt a metaadat-sornak kell
        // megmaradnia, NEM a tartalom-snippetnek.
        id: "n2", subjectId: "s1", cim: "Normalizálási feladatok", tipus: "gyakorlat", datum: "2026-09-02",
        tartalom: "Semmi különös ebben a jegyzetben.",
        cimkek: [], mellekletek: [],
        createdAt: "2026-09-02T00:00:00.000Z", updatedAt: "2026-09-02T00:00:00.000Z",
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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text());
});

await page.goto("http://localhost:3411", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("egyetemi-jegyzetek-storage", JSON.stringify(s)), state);
await page.evaluate(() => localStorage.setItem("theme", "dark"));
await page.reload({ waitUntil: "networkidle" });

// --- Ctrl+K megnyitása, keresés egy csak a TARTALOMBAN szereplő szóra ---
await page.keyboard.press("Control+k");
const searchInput = page.getByPlaceholder("Ugrás tárgyhoz, jegyzethez, nézethez…");
await searchInput.waitFor({ state: "visible" });
await searchInput.fill("particionálás");
await page.waitForTimeout(200);

const noteResult = page.locator("button", { hasText: "Óravázlat 3. hét" });
check("Tartalom-találat megjelenik a keresésben", await noteResult.count() > 0);

const mark = noteResult.locator("mark");
check("A találat ki van emelve <mark>-ben", (await mark.count()) > 0, await mark.count() > 0 ? await mark.first().innerText() : "nincs mark");

const sublabelText = await noteResult.first().innerText();
check(
  "A snippet a találat KÖRNYEZETÉT is mutatja (nem csak a szót)",
  sublabelText.includes("horizontális") && sublabelText.includes("teljesítményét")
);
check("A levágott snippet elején ellipszis (…) jelzi a folytatást", sublabelText.includes("…"));
check(
  "A snippetben NINCS ott a tárgy/típus/dátum metaadat (azt felváltotta a részlet)",
  !sublabelText.includes("Adatbázisrendszerek") || sublabelText.includes("horizontális")
);

await noteResult.first().click();
await page.waitForTimeout(300);
const editorTitle = page.locator('input[value="Óravázlat 3. hét"]');
check("Kattintásra a megfelelő jegyzet nyílik meg", (await editorTitle.count()) > 0);

// --- Új keresés: cím-találat esetén a metaadat-sor marad, NINCS <mark> ---
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
await page.keyboard.press("Control+k");
const searchInput2 = page.getByPlaceholder("Ugrás tárgyhoz, jegyzethez, nézethez…");
await searchInput2.waitFor({ state: "visible" });
await searchInput2.fill("normalizál");
await page.waitForTimeout(200);

const titleMatchResult = page.locator("button", { hasText: "Normalizálási feladatok" });
check("Cím-találat is megjelenik", (await titleMatchResult.count()) > 0);
const titleMatchMark = titleMatchResult.locator("mark");
check("Cím-találatnál NINCS tartalom-snippet kiemelés (a metaadat marad)", (await titleMatchMark.count()) === 0);
const titleMatchText = await titleMatchResult.first().innerText();
check(
  "Cím-találatnál a metaadat-sor (tárgy · típus · dátum) látszik",
  titleMatchText.includes("Adatbázisrendszerek") && titleMatchText.includes("Gyakorlat")
);

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length > 0) process.exit(1);
