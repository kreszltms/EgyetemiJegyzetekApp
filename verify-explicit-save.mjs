import { chromium } from "playwright";

// ============================================================================
// UNINOTES — Explicit mentés (nincs automentés) verifikáció
//
// A hibajelentés: a jegyzetszerkesztőben törölt egy felhasználó egy képet,
// majd a "Mégse" gombra kattintott — de a kép mégis törölve maradt, mert a
// régi 700ms-es automentés már lefutott, mielőtt a "Mégse" megtörtént.
//
// Ez a szkript azt ellenőrzi, hogy:
//   1) szerkesztés közben (autosave NÉLKÜL) a lábléc "Nem mentett
//      módosítások" jelzést mutat,
//   2) egy képmelléklet törlése + "Mégse" ESETÉN megerősítő ablak jön fel,
//      és a "Vissza a szerkesztéshez" gombbal a kép még mindig ott van,
//   3) ugyanez, de "Elvetés mentés nélkül"-lel bezárva: a jegyzet
//      újranyitva a kép VÁLTOZATLANUL megvan (a törlés nem perzisztálódott
//      — ez a konkrét, korábban hibás eset),
//   4) explicit "Mentés" gombbal viszont a törlés ténylegesen elmentődik,
//   5) tiszta (nem módosított) szerkesztő X-szel bezárva NEM kérdez rá
///     semmit (nincs felesleges súrlódás).
// ============================================================================

const baseState = {
  state: {
    semesters: [
      { id: "sem-c", nev: "2026/27/1 (Aktuális félév)", aktiv: true, archivalt: false, createdAt: "2026-09-01T00:00:00.000Z" },
    ],
    subjects: [
      {
        id: "s1", semesterId: "sem-c", nev: "Mentés Teszt Tárgy", kod: "MENT1", szin: "#22c55e", ikon: "Code2",
        oktato: { nev: "", email: "", fogadoora: "" },
        hianyzas: { maxHianyzas: 3, jelenlegiHianyzas: 0 }, kovetelmenyek: [],
        kredit: 5,
        createdAt: "2026-09-05T00:00:00.000Z", updatedAt: "2026-09-05T00:00:00.000Z",
      },
    ],
    notes: [
      {
        id: "n1", subjectId: "s1", cim: "Explicit mentés teszt", tipus: "eloadas", datum: "2026-09-05",
        tartalom: "Eredeti tartalom.",
        cimkek: [],
        mellekletek: [
          {
            id: "att1",
            nev: "teszt-kep.png",
            meret: 1234,
            dataUrl:
              "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC",
          },
        ],
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

function seed(page, state) {
  return page.evaluate((s) => localStorage.setItem("egyetemi-jegyzetek-storage", JSON.stringify(s)), state);
}

async function openNote(page) {
  await page.keyboard.press("Control+k");
  const searchInput = page.getByPlaceholder("Ugrás tárgyhoz, jegyzethez, nézethez…");
  await searchInput.waitFor({ state: "visible" });
  await searchInput.fill("Explicit mentés teszt");
  await page.waitForTimeout(200);
  await page.locator("button", { hasText: "Explicit mentés teszt" }).first().click();
  await page.waitForTimeout(300);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text());
});

await page.goto("http://localhost:3411", { waitUntil: "networkidle" });
await seed(page, baseState);
await page.evaluate(() => localStorage.setItem("theme", "dark"));
await page.reload({ waitUntil: "networkidle" });

// --- 1) Szerkesztés közben "Nem mentett módosítások" jelenik meg -----------
await openNote(page);

const dirtyBadge = page.locator("text=Nem mentett módosítások");
check("Tiszta (még nem módosított) jegyzetnél NINCS 'Nem mentett módosítások' jelzés", (await dirtyBadge.count()) === 0);

const attachmentThumb = page.locator('img[alt="teszt-kep.png"]');
check("A meglévő képmelléklet látszik a szerkesztő megnyitásakor", (await attachmentThumb.count()) > 0);

const textarea = page.getByLabel("Jegyzet tartalma (Markdown)");
await textarea.click();
await page.keyboard.type(" Módosítás.");
await page.waitForTimeout(150);
check("Szövegmódosítás után megjelenik a 'Nem mentett módosítások' jelzés", (await dirtyBadge.count()) > 0);

// --- 2) Kép törlése + "Mégse" -> megerősítő ablak, "Vissza a szerkesztéshez"
const removeAttachmentButton = page.getByRole("button", { name: "teszt-kep.png melléklet eltávolítása" });
await removeAttachmentButton.click();
await page.waitForTimeout(150);
check("A kép eltűnik a szerkesztő nézetből (helyi állapotban) törlés után", (await attachmentThumb.count()) === 0);

const cancelButton = page.getByRole("button", { name: "Mégse", exact: true });
await cancelButton.click();
await page.waitForTimeout(200);

const confirmDialogTitle = page.getByRole("heading", { name: "Elveted a nem mentett módosításokat?" });
check("Kép törlése után 'Mégse'-re megerősítő ablak jelenik meg (nem záródik be azonnal)", (await confirmDialogTitle.count()) > 0);

const backToEditButton = page.getByRole("button", { name: "Vissza a szerkesztéshez" });
await backToEditButton.click();
await page.waitForTimeout(200);
check(
  "'Vissza a szerkesztéshez'-re a szerkesztő NYITVA marad (nem veszett el semmi automatikusan)",
  (await page.getByLabel("Jegyzet tartalma (Markdown)").count()) > 0
);

// --- 3) Ugyanez, de most "Elvetés mentés nélkül" -> a jegyzet ÚJRANYITVA a
// kép VÁLTOZATLANUL megvan (a törlés soha nem perzisztálódott) ------------
await cancelButton.click();
await page.waitForTimeout(200);
const discardButton = page.getByRole("button", { name: "Elvetés mentés nélkül" });
await discardButton.click();
await page.waitForTimeout(300);

const editorGone = (await page.getByLabel("Jegyzet tartalma (Markdown)").count()) === 0;
check("'Elvetés mentés nélkül' ténylegesen bezárja a szerkesztőt", editorGone);

await openNote(page);
const attachmentThumbAfterDiscard = page.locator('img[alt="teszt-kep.png"]');
check(
  "A KORÁBBAN TÖRÖLT kép újranyitáskor VÁLTOZATLANUL megvan — a törlés NEM perzisztálódott (ez volt a jelentett hiba)",
  (await attachmentThumbAfterDiscard.count()) > 0
);
const textareaAfterDiscard = page.getByLabel("Jegyzet tartalma (Markdown)");
const contentAfterDiscard = await textareaAfterDiscard.inputValue();
check(
  "A korábbi (el nem mentett) szövegmódosítás sem maradt meg — 'Eredeti tartalom.' látszik",
  contentAfterDiscard.trim() === "Eredeti tartalom."
);

// --- 4) Explicit "Mentés" gombbal a törlés TÉNYLEG elmentődik ---------------
const removeAttachmentButton2 = page.getByRole("button", { name: "teszt-kep.png melléklet eltávolítása" });
await removeAttachmentButton2.click();
await page.waitForTimeout(150);
const saveButton = page.getByRole("button", { name: "Mentés", exact: true });
await saveButton.click();
await page.waitForTimeout(300);

const savedBadge = page.locator("text=/Mentve \\d{2}:\\d{2}-kor/");
check("Mentés után a lábléc 'Mentve HH:MM-kor' állapotot mutat (nem 'Nem mentett módosítások')", (await savedBadge.count()) > 0);

// Tiszta állapotban az X-szel való bezárás NEM kérdez rá semmire.
const closeButton = page.getByRole("button", { name: "Bezárás" });
await closeButton.click();
await page.waitForTimeout(200);
const noDialogOnCleanClose = (await page.getByRole("heading", { name: "Elveted a nem mentett módosításokat?" }).count()) === 0;
check("Mentés utáni (tiszta) bezáráskor NINCS felesleges megerősítő ablak", noDialogOnCleanClose);

await openNote(page);
const attachmentThumbAfterSave = page.locator('img[alt="teszt-kep.png"]');
check(
  "Újranyitva a kép TÉNYLEG törölve van, mert most explicit Mentés történt",
  (await attachmentThumbAfterSave.count()) === 0
);

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length > 0) process.exit(1);
