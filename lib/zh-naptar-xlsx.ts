import * as XLSX from "xlsx";

// ============================================================================
// EGYETEMI JEGYZETEK — Egyetemi ZH-naptár (intézményi xlsx) beolvasása
//
// Ez a fájl NEM a hallgató saját Neptun-exportja, hanem az egyetem által
// közzétett, MINDEN tárgyra vonatkozó ZH-naptár (több száz sor). A
// ténylegesen kapott minta felépítése:
//
//   1. sor: cím ("Véleményezésre közzétett zh-naptár tervezet / ...")
//   2. sor: fejléc — CoSpace-színtérazonosító | Tárgynév | Subject name |
//                    Tanszék | Campus | Helyszín | ZH1 | ZH2 | ZH3
//   3.. sor: adatok, pl.:
//     "ADAN0BA03-2026/27/1-AADANINFENHU01" | "Adatbányászat..." | ... |
//     "2026. 10. 08-09." | "2026. 11. 12-13." | "2026. 12. 08."
//
// Fontos sajátosságok:
//  - A "CoSpace-színtérazonosító" oszlop első "-" előtti szelete a
//    Neptun-féle TÁRGYKÓD (pl. "ADAN0BA03") — erre keresünk rá.
//  - Egy tárgykódhoz TÖBB sor is tartozhat (pl. HU/EN nyelvű vagy több
//    csoport ugyanarra a tárgyra, eltérő ZH-dátumokkal) — ezért a
//    keresési találatokat mindig listaként adjuk vissza, a felhasználó
//    választja ki a rá vonatkozót.
//  - Egy ZH dátuma lehet: pontos nap ("2026. 12. 08."), azonos hónapon
//    belüli tartomány ("2026. 10. 08-09.") vagy hónapváltós tartomány
//    ("2026. 11. 30 - 12. 01.") — ez utóbbi kettő azt jelzi, hogy a ZH
//    több napon (pl. csoportonként eltérő napon) kerül megtartásra.
//  - Némelyik cellában nincs konkrét dátum, csak "A tantárgyleírás
//    szerint. / See course description." szöveg szerepel — ezt dátum
//    nélküli, informatív bejegyzésként kezeljük.
//
// A parser a FEJLÉC SZÖVEGE alapján azonosítja az oszlopokat (nem fix
// pozíció szerint), és megkeresi a fejléc sort az első néhány sorban.
// ============================================================================

export type ZhSlotLabel = "ZH1" | "ZH2" | "ZH3";

export interface ZhSlot {
  label: ZhSlotLabel;
  /** A cellában szereplő eredeti szöveg, változtatás nélkül. */
  raw: string;
  /** true, ha a cella nem konkrét dátum(tartomány), hanem tájékoztató szöveg. */
  isPlaceholder: boolean;
  /** ISO dátum (YYYY-MM-DD) — a tartomány első napja, vagy az egyetlen nap. */
  startDate?: string;
  /** ISO dátum (YYYY-MM-DD) — a tartomány utolsó napja (egynapos ZH-nál = startDate). */
  endDate?: string;
}

export interface ZhCalendarEntry {
  id: string;
  /** Teljes CoSpace-azonosító, pl. "ADAN0BA03-2026/27/1-AADANINFENHU01". */
  cospaceId: string;
  /** Az azonosító első szelete — ez feleltethető meg a tárgy "Tárgykód" mezőjének. */
  targykod: string;
  /** A középső szelet, pl. "2026/27/1". */
  felev?: string;
  /** A harmadik szelet (kurzus/csoport-azonosító), pl. "AADANINFENHU01". */
  kurzusAzonosito?: string;
  targynevHu: string;
  targynevEn?: string;
  tanszek?: string;
  campus?: string;
  helyszin?: string;
  slots: ZhSlot[];
}

export type ZhNaptarParseResult =
  | { success: true; entries: ZhCalendarEntry[] }
  | { success: false; error: string };

const HEADER_SEARCH_ROWS = 15;

// "2026. 12. 08." — egyetlen nap
const RE_SINGLE = /^(\d{4})\.\s*(\d{2})\.\s*(\d{2})\.$/;
// "2026. 10. 08-09." — azonos hónapon belüli tartomány
const RE_SAME_MONTH_RANGE = /^(\d{4})\.\s*(\d{2})\.\s*(\d{2})\s*-\s*(\d{2})\.$/;
// "2026. 11. 30 - 12. 01." — hónapváltós tartomány
const RE_CROSS_MONTH_RANGE =
  /^(\d{4})\.\s*(\d{2})\.\s*(\d{2})\s*-\s*(\d{2})\.\s*(\d{2})\.$/;

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Egy ZH-cella nyers szövegét dátum(tartomány)ra bontja, ha lehet. */
function parseZhSlotRaw(raw: string): Pick<ZhSlot, "isPlaceholder" | "startDate" | "endDate"> {
  const text = raw.trim();

  const single = RE_SINGLE.exec(text);
  if (single) {
    const [, y, m, d] = single;
    const iso = `${y}-${pad2(Number(m))}-${pad2(Number(d))}`;
    return { isPlaceholder: false, startDate: iso, endDate: iso };
  }

  const crossMonth = RE_CROSS_MONTH_RANGE.exec(text);
  if (crossMonth) {
    const [, y, m1, d1, m2, d2] = crossMonth;
    const year1 = Number(y);
    // Ha a záró hónap kisebb, mint a kezdő (pl. dec -> jan), évet váltunk.
    const year2 = Number(m2) < Number(m1) ? year1 + 1 : year1;
    return {
      isPlaceholder: false,
      startDate: `${year1}-${pad2(Number(m1))}-${pad2(Number(d1))}`,
      endDate: `${year2}-${pad2(Number(m2))}-${pad2(Number(d2))}`,
    };
  }

  // Fontos: ezt a mintát csak a hónapváltós próbálkozás UTÁN érdemes
  // nézni, mert az azonos hónapos regex is illeszkedne a hónapváltós
  // szöveg elejére, ha korábban futna — de mivel a hónapváltós minta
  // szigorúbb (két ponttal záródik), a sorrend itt nem okoz ütközést.
  const sameMonth = RE_SAME_MONTH_RANGE.exec(text);
  if (sameMonth) {
    const [, y, m, d1, d2] = sameMonth;
    const iso1 = `${y}-${pad2(Number(m))}-${pad2(Number(d1))}`;
    const iso2 = `${y}-${pad2(Number(m))}-${pad2(Number(d2))}`;
    return { isPlaceholder: false, startDate: iso1, endDate: iso2 };
  }

  return { isPlaceholder: true };
}

function findColumn(headerRow: unknown[], predicate: (text: string) => boolean): number {
  for (let i = 0; i < headerRow.length; i++) {
    const text = String(headerRow[i] ?? "").trim();
    if (predicate(text)) return i;
  }
  return -1;
}

export async function parseZhNaptarFile(file: File): Promise<ZhNaptarParseResult> {
  let rows: unknown[][];
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { success: false, error: "A fájl nem tartalmaz munkalapot." };
    }
    rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      raw: false,
      defval: "",
    }) as unknown[][];
  } catch {
    return {
      success: false,
      error: "A fájl nem olvasható be. Győződj meg róla, hogy érvényes .xlsx fájlt választottál.",
    };
  }

  let headerRowIndex = -1;
  let cospaceCol = -1;
  let nameHuCol = -1;
  let nameEnCol = -1;
  let tanszekCol = -1;
  let campusCol = -1;
  let helyszinCol = -1;
  let zh1Col = -1;
  let zh2Col = -1;
  let zh3Col = -1;

  for (let i = 0; i < Math.min(rows.length, HEADER_SEARCH_ROWS); i++) {
    const row = rows[i] ?? [];
    const cCol = findColumn(row, (t) => t.includes("CoSpace"));
    const nCol = findColumn(row, (t) => t === "Tárgynév");
    const z1Col = findColumn(row, (t) => t.includes("ZH1"));
    if (cCol !== -1 && nCol !== -1 && z1Col !== -1) {
      headerRowIndex = i;
      cospaceCol = cCol;
      nameHuCol = nCol;
      nameEnCol = findColumn(row, (t) => t === "Subject name");
      tanszekCol = findColumn(row, (t) => t.includes("Tanszék"));
      campusCol = findColumn(row, (t) => t === "Campus");
      helyszinCol = findColumn(row, (t) => t.includes("Helyszín"));
      zh1Col = z1Col;
      zh2Col = findColumn(row, (t) => t.includes("ZH2"));
      zh3Col = findColumn(row, (t) => t.includes("ZH3"));
      break;
    }
  }

  if (headerRowIndex === -1) {
    return {
      success: false,
      error:
        "Nem ismerhető fel a fájl formátuma — a várt oszlopok (CoSpace-színtérazonosító, Tárgynév, ZH1) nem találhatók. Győződj meg róla, hogy az egyetemi ZH-naptár xlsx fájlját töltötted fel.",
    };
  }

  const entries: ZhCalendarEntry[] = [];
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const cospaceId = String(row[cospaceCol] ?? "").trim();
    const targynevHu = String(row[nameHuCol] ?? "").trim();
    if (!cospaceId || !targynevHu) continue; // üres sor kihagyása

    const parts = cospaceId.split("-");
    const targykod = (parts[0] ?? cospaceId).trim();
    const felev = parts[1]?.trim() || undefined;
    const kurzusAzonosito = parts.length > 2 ? parts.slice(2).join("-").trim() : undefined;

    const slots: ZhSlot[] = [];
    const slotCols: [ZhSlotLabel, number][] = [
      ["ZH1", zh1Col],
      ["ZH2", zh2Col],
      ["ZH3", zh3Col],
    ];
    for (const [label, col] of slotCols) {
      if (col === -1) continue;
      const raw = String(row[col] ?? "").trim();
      if (!raw) continue;
      slots.push({ label, raw, ...parseZhSlotRaw(raw) });
    }
    if (slots.length === 0) continue;

    entries.push({
      id: `${targykod}__${kurzusAzonosito ?? i}`,
      cospaceId,
      targykod,
      felev,
      kurzusAzonosito,
      targynevHu,
      targynevEn: nameEnCol !== -1 ? String(row[nameEnCol] ?? "").trim() || undefined : undefined,
      tanszek: tanszekCol !== -1 ? String(row[tanszekCol] ?? "").trim() || undefined : undefined,
      campus: campusCol !== -1 ? String(row[campusCol] ?? "").trim() || undefined : undefined,
      helyszin: helyszinCol !== -1 ? String(row[helyszinCol] ?? "").trim() || undefined : undefined,
      slots,
    });
  }

  if (entries.length === 0) {
    return {
      success: false,
      error: "A fájlban nem található egyetlen feldolgozható tárgy/ZH sem.",
    };
  }

  return { success: true, entries };
}
