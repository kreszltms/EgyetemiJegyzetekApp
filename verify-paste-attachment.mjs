import { chromium } from "playwright";

// ============================================================================
// UNINOTES — Ctrl+V képcsatolás verifikáció
//
// Azt ellenőrzi, hogy a jegyzet-szerkesztő textarea-jába vágólapról
// beillesztett kép (nem fájlválasztóval feltöltött!) valódi mellékletté
// alakul-e — ugyanazon a feldolgozó láncon (processImageFile) keresztül,
// mint a "Kép csatolása" gomb.
//
// Mivel a böngésző natív vágólapját nem tudjuk közvetlenül feltölteni egy
// headless szkriptből, egy szintetikus ClipboardEvent-et hozunk létre a
// lapon belül: egy in-memory PNG-ből File-t készítünk, DataTransfer-be
// tesszük, és "paste" eseményként diszpécseljük a textarea-ra — ez pontosan
// azt az API-t gyakorolja (e.clipboardData.items), amit a NoteEditor
// handlePasteAttachment függvénye olvas.
// ============================================================================

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
        id: "n1", subjectId: "s1", cim: "Vágólap-teszt jegyzet", tipus: "eloadas", datum: "2026-09-05",
        tartalom: "Kezdeti tartalom.",
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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text());
});

await page.goto("http://localhost:3411", { waitUntil: "networkidle" });
await page.evaluate((s) => localStorage.setItem("egyetemi-jegyzetek-storage", JSON.stringify(s)), state);
await page.evaluate(() => localStorage.setItem("theme", "dark"));
await page.reload({ waitUntil: "networkidle" });

// --- Navigálás a jegyzethez a Ctrl+K palettán keresztül -------------------
await page.keyboard.press("Control+k");
const searchInput = page.getByPlaceholder("Ugrás tárgyhoz, jegyzethez, nézethez…");
await searchInput.waitFor({ state: "visible" });
await searchInput.fill("Vágólap-teszt");
await page.waitForTimeout(200);
await page.locator("button", { hasText: "Vágólap-teszt jegyzet" }).first().click();
await page.waitForTimeout(300);

const textarea = page.getByLabel("Jegyzet tartalma (Markdown)");
check("A szerkesztő textarea megjelenik", (await textarea.count()) > 0);
await textarea.click();

// --- Szintetikus kép-paste esemény a lapon belül ---------------------------
const pasteResult = await page.evaluate(async () => {
  function findTextarea() {
    return document.querySelector('textarea[aria-label="Jegyzet tartalma (Markdown)"]');
  }
  const ta = findTextarea();
  if (!ta) return { dispatched: false, reason: "textarea nem található" };

  // 2x2-es piros PNG base64 -> bájtok -> File (kis, garantáltan érvényes
  // kép). Szándékosan NEM fetch(dataUrl)-lal alakítjuk Blob-bá — az appon
  // beállított szigorú connect-src CSP (lásd next.config.ts) pont az ilyen
  // data: URI-hoz szóló fetch-eket tiltja, amit itt kerülünk el.
  const base64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const file = new File([bytes], "vagolap-kep.png", { type: "image/png" });

  const dt = new DataTransfer();
  dt.items.add(file);

  let evt;
  try {
    evt = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: dt,
    });
  } catch {
    // Ha a böngésző nem engedi a clipboardData-t a konstruktorban, sima
    // Event-et hozunk létre és property-ként ráakasztjuk (Chromium ezt is
    // elfogadja, mert a React onPaste csak e.clipboardData-t olvassa).
    evt = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(evt, "clipboardData", { value: dt });
  }

  const notPrevented = ta.dispatchEvent(evt);
  return { dispatched: true, defaultPrevented: !notPrevented };
});
check(
  "A szintetikus paste esemény lefutott és a textarea alapértelmezett viselkedése meg lett akadályozva (kép, nem szöveg)",
  pasteResult.dispatched && pasteResult.defaultPrevented,
  JSON.stringify(pasteResult)
);

// A feldolgozás (canvas tömörítés) aszinkron — várunk rá.
await page.waitForTimeout(800);

const thumb = page.locator('img[alt="vagolap-kep.png"]');
check("A beillesztett kép megjelenik a melléklet-miniatűrök között", (await thumb.count()) > 0);

const textareaValue = await textarea.inputValue();
check(
  "A beillesztett kép NEM íródott bele szövegként a jegyzet tartalmába",
  !textareaValue.includes("data:image") && !textareaValue.includes("base64")
);

// --- Kontroll: sima szöveg-paste továbbra is normálisan működik ------------
await textarea.click();
await page.keyboard.press("Control+a");
await page.keyboard.type("marker-elotte-");
const textPasteWorked = await page.evaluate(() => {
  const ta = document.querySelector('textarea[aria-label="Jegyzet tartalma (Markdown)"]');
  const dt = new DataTransfer();
  dt.setData("text/plain", "BEILLESZTETT-SZOVEG");
  let evt;
  try {
    evt = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt });
  } catch {
    evt = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(evt, "clipboardData", { value: dt });
  }
  return ta.dispatchEvent(evt); // true = NEM lett megakadályozva
});
check(
  "Sima szöveg beillesztésekor a natív viselkedés NEM lett megakadályozva (a kép-kezelő nem nyúl bele)",
  textPasteWorked === true
);

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length > 0) process.exit(1);
