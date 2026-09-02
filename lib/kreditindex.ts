import { summarizePontozas } from "@/lib/pontozas";
import type { Subject } from "@/types";

// ============================================================================
// EGYETEMI JEGYZETEK — Kreditindex (kredit-súlyozott átlag) segédfüggvények
// A "jegy" minden tárgynál a Pontozás kártyán megadott pontok alapján
// BECSÜLT aktuális érdemjegy (lásd lib/pontozas.ts summarizePontozas) —
// nincs külön "lezárt/hivatalos jegy" mező, tehát ez mindig egy élő,
// pontok alapján frissülő becslés, nem hivatalos leckekönyvi index.
// Egy tárgy csak akkor számít bele az átlagba, ha van kreditértéke ÉS
// legalább egy követelményébe már be van írva elért pontszám — enélkül
// a becsült jegy értelmetlen lenne (mindig 1-es, hiszen 0 pontból indul).
// ============================================================================

export interface KreditIndexItem {
  subject: Subject;
  kredit: number;
  hasKredit: boolean;
  /** Pontozásból becsült aktuális jegy, vagy `null`, ha még nincs beírt pont. */
  grade: number | null;
  /** Benne van-e a súlyozott átlag számításában. */
  included: boolean;
}

export interface KreditIndexResult {
  items: KreditIndexItem[];
  weightedSum: number;
  totalKredit: number;
  /** Kredit-súlyozott átlag két tizedesjegyre kerekítve, vagy `null`, ha nincs egyetlen beszámítható tárgy sem. */
  average: number | null;
  includedCount: number;
  totalCount: number;
  /**
   * A ténylegesen MEGSZERZETT (teljesített) kredit összege — csak azoké a
   * beszámítható tárgyaké, amelyeknek a becsült jegye legalább 2-es, mert a
   * magyar felsőoktatásban elégtelen (1-es) jegyért nem jár kredit. Ez az
   * érték hajtja a "Diplomához szükséges kredit" tervezőt.
   */
  earnedKredit: number;
}

export function computeKreditIndex(subjects: Subject[]): KreditIndexResult {
  const items: KreditIndexItem[] = subjects.map((subject) => {
    const kredit = subject.kredit ?? 0;
    const hasKredit = typeof subject.kredit === "number" && subject.kredit > 0;
    const hasScoredItem = subject.kovetelmenyek.some(
      (r) => typeof r.pontszamSzerzett === "number" && !Number.isNaN(r.pontszamSzerzett)
    );
    const grade = hasScoredItem
      ? summarizePontozas(subject.kovetelmenyek, subject.pontozas).currentGrade
      : null;
    return { subject, kredit, hasKredit, grade, included: hasKredit && grade !== null };
  });

  let weightedSum = 0;
  let totalKredit = 0;
  let earnedKredit = 0;
  for (const item of items) {
    if (!item.included || item.grade === null) continue;
    weightedSum += item.grade * item.kredit;
    totalKredit += item.kredit;
    if (item.grade >= 2) earnedKredit += item.kredit;
  }

  const average = totalKredit > 0 ? Math.round((weightedSum / totalKredit) * 100) / 100 : null;
  const includedCount = items.filter((i) => i.included).length;

  return {
    items,
    weightedSum,
    totalKredit,
    average,
    includedCount,
    totalCount: items.length,
    earnedKredit,
  };
}
