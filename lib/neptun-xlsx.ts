import * as XLSX from "xlsx";

import type { ScheduleEvent, ScheduleEventType } from "@/types";

// ============================================================================
// EGYETEMI JEGYZETEK — Neptun "Tanóra" xlsx export beolvasása
//
// A Neptun órarend-export felépítése (a ténylegesen tesztelt minta alapján):
//   1. sor: egy "Tanóra" című sor (nem mindig van jelen)
//   2. sor: fejléc — Kezdés | Befejezés | Név | Kurzus típus | Kurzuskód |
//                    Oktató | Tereminfó
//   3.. sor: adatok, pl. "2026. szeptember 7. 12:00" formátumú dátumokkal
//            (sima szövegként, nem Excel dátumként tárolva).
//
// A parser a FEJLÉC SZÖVEGE alapján azonosítja az oszlopokat (nem fix
// pozíció szerint), és megkeresi a fejléc sort az első néhány sorban — így
// akkor is működik, ha a címsor hiányzik vagy az oszlopsorrend eltér.
// ============================================================================

const HU_MONTHS: Record<string, number> = {
  január: 1,
  február: 2,
  március: 3,
  április: 4,
  május: 5,
  június: 6,
  július: 7,
  augusztus: 8,
  szeptember: 9,
  október: 10,
  november: 11,
  december: 12,
};

const HU_DATETIME_RE = /^(\d{4})\.\s*([^\d\s.]+)\s+(\d{1,2})\.\s+(\d{1,2}):(\d{2})$/;

/**
 * "2026. szeptember 7. 12:00" -> "2026-09-07T12:00:00" (helyi idő, nincs
 * "Z" utótag — így a böngésző a felhasználó saját időzónájában, a Neptunban
 * megadott órarendi időpontnak megfelelően jeleníti meg).
 */
export function parseHungarianDateTime(raw: string): string | null {
  const match = HU_DATETIME_RE.exec(raw.trim());
  if (!match) return null;
  const [, yearStr, monthNameRaw, dayStr, hourStr, minuteStr] = match;
  const month = HU_MONTHS[monthNameRaw.trim().toLowerCase()];
  if (!month) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${yearStr}-${pad(month)}-${pad(Number(dayStr))}T${pad(Number(hourStr))}:${minuteStr}:00`;
}

/** A Neptun "Kurzus típus" mezőjét a jegyzet-kategóriákra képezi le. */
export function mapKurzusTipus(raw: string | undefined | null): ScheduleEventType {
  const normalized = (raw ?? "").trim().toLowerCase();
  if (normalized.startsWith("elmélet")) return "eloadas";
  if (normalized.startsWith("gyakorlat")) return "gyakorlat";
  if (normalized.startsWith("labor")) return "labor";
  return "egyeb";
}

const REQUIRED_HEADERS = ["Kezdés", "Befejezés", "Név", "Kurzus típus"];

export type ParsedScheduleEvent = Omit<ScheduleEvent, "id" | "subjectId">;

export type NeptunParseResult =
  | { success: true; events: ParsedScheduleEvent[] }
  | { success: false; error: string };

export async function parseNeptunScheduleFile(file: File): Promise<NeptunParseResult> {
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

  // Fejléc sor keresése az első pár sorban (a Neptun export elején lehet
  // egy "Tanóra" című sor a valódi fejléc előtt).
  let headerRowIndex = -1;
  let columnIndex: Record<string, number> = {};
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const idx: Record<string, number> = {};
    (rows[i] ?? []).forEach((cell, colIdx) => {
      const text = String(cell ?? "").trim();
      if (text) idx[text] = colIdx;
    });
    if (REQUIRED_HEADERS.every((h) => h in idx)) {
      headerRowIndex = i;
      columnIndex = idx;
      break;
    }
  }

  if (headerRowIndex === -1) {
    return {
      success: false,
      error:
        "Nem ismerhető fel a fájl formátuma — a várt oszlopok (Kezdés, Befejezés, Név, Kurzus típus) nem találhatók. Győződj meg róla, hogy a Neptun „Tanóra” exportját töltötted fel.",
    };
  }

  const events: ParsedScheduleEvent[] = [];
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const get = (header: string): string => {
      const idx = columnIndex[header];
      return idx === undefined ? "" : String(row[idx] ?? "").trim();
    };

    const cim = get("Név");
    const kezdesRaw = get("Kezdés");
    if (!cim || !kezdesRaw) continue; // üres vagy záró sor kihagyása

    const kezdes = parseHungarianDateTime(kezdesRaw);
    if (!kezdes) continue; // nem értelmezhető dátumformátum — kihagyjuk

    const befejezes = parseHungarianDateTime(get("Befejezés")) ?? kezdes;

    events.push({
      cim,
      tipus: mapKurzusTipus(get("Kurzus típus")),
      kezdes,
      befejezes,
      kurzuskod: get("Kurzuskód") || undefined,
      oktato: get("Oktató").replace(/;/g, ", ") || undefined,
      terem: get("Tereminfó") || undefined,
    });
  }

  if (events.length === 0) {
    return {
      success: false,
      error: "A fájlban nem található egyetlen feldolgozható óra sem.",
    };
  }

  return { success: true, events };
}
