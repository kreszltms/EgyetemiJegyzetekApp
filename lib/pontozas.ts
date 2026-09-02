import { DEFAULT_PONTOZAS } from "@/types";
import type { PontHatar, PontozasConfig, Requirement } from "@/types";

// ============================================================================
// EGYETEMI JEGYZETEK — Pontozás segédfüggvények
// A tárgyankénti (esetenként eltérő) jegyhatárok alapján számolja ki, hol
// tart a hallgató, és mennyi pont kell még a következő jegyhez — a
// hátralévő (még nem osztályozott) tételek maximális pontszáma alapján azt
// is jelzi, hogy ez reálisan elérhető-e még.
// ============================================================================

/** Mindig ezzel olvasandó a tárgy pontozás-beállítása — régebbi tárgyaknál
 * hiányozhat a mező, ilyenkor az alapértelmezett beosztást használjuk. */
export function getPontozas(pontozas: PontozasConfig | undefined): PontozasConfig {
  return pontozas ?? DEFAULT_PONTOZAS;
}

/** Összpontszám alapján megállapítja az érdemjegyet — a legmagasabb olyan
 * határ jegye érvényes, amelyet a pontszám elér; ha egyiket sem éri el,
 * az eredmény 1 (elégtelen). */
export function calculateGrade(totalPont: number, hatarok: PontHatar[]): number {
  const sorted = [...hatarok].sort((a, b) => a.minPont - b.minPont);
  let grade = 1;
  for (const h of sorted) {
    if (totalPont >= h.minPont) grade = h.jegy;
  }
  return grade;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface PontozasSummary {
  /** A ténylegesen megszerzett pontok összege (csak a beírt tételekből). */
  totalSzerzett: number;
  /** A meghirdetett (max) pontok összege az ÖSSZES tételnél, ahol meg van adva. */
  totalMaxKiirt: number;
  /** A még nem osztályozott tételeknél meghirdetett max pontok összege — ennyi szerezhető még. */
  remainingMax: number;
  /** A jelenlegi (eddig megszerzett pontok alapján számolt) becsült érdemjegy. */
  currentGrade: number;
  /** A következő (jobb) jegy, ha van ilyen a beosztásban — egyébként null. */
  nextGrade: number | null;
  /** Ehhez a pontszám még hiányzik a következő jegyhez (legalább 0). */
  pointsNeededForNextGrade: number | null;
  /** A hátralévő tételek maximális pontszáma alapján reálisan elérhető-e még a következő jegy. */
  nextGradeReachable: boolean | null;
  /** Van-e egyáltalán még nem osztályozott (pontszámot még nem kapott) tétel. */
  hasUnscoredItems: boolean;
}

export function summarizePontozas(
  requirements: Requirement[],
  pontozasInput: PontozasConfig | undefined
): PontozasSummary {
  const pontozas = getPontozas(pontozasInput);
  let totalSzerzett = 0;
  let totalMaxKiirt = 0;
  let remainingMax = 0;

  for (const r of requirements) {
    if (typeof r.pontszamSzerzett === "number" && !Number.isNaN(r.pontszamSzerzett)) {
      totalSzerzett += r.pontszamSzerzett;
    }
    if (typeof r.pontszamMax === "number" && !Number.isNaN(r.pontszamMax)) {
      totalMaxKiirt += r.pontszamMax;
      if (typeof r.pontszamSzerzett !== "number") {
        remainingMax += r.pontszamMax;
      }
    }
  }

  totalSzerzett = round1(totalSzerzett);
  totalMaxKiirt = round1(totalMaxKiirt);
  remainingMax = round1(remainingMax);

  const sorted = [...pontozas.hatarok].sort((a, b) => a.minPont - b.minPont);
  const currentGrade = calculateGrade(totalSzerzett, sorted);
  const nextThreshold = sorted.find((h) => h.jegy > currentGrade && h.minPont > totalSzerzett);

  let nextGrade: number | null = null;
  let pointsNeededForNextGrade: number | null = null;
  let nextGradeReachable: boolean | null = null;
  if (nextThreshold) {
    nextGrade = nextThreshold.jegy;
    pointsNeededForNextGrade = round1(Math.max(0, nextThreshold.minPont - totalSzerzett));
    nextGradeReachable = remainingMax >= pointsNeededForNextGrade;
  }

  const hasUnscoredItems = requirements.some((r) => typeof r.pontszamSzerzett !== "number");

  return {
    totalSzerzett,
    totalMaxKiirt,
    remainingMax,
    currentGrade,
    nextGrade,
    pointsNeededForNextGrade,
    nextGradeReachable,
    hasUnscoredItems,
  };
}

/** Magyar jegyragozás táblázata — a sima "-es" végződés a 3-as és az 5-ös
 * esetén nyelvtanilag hibás lenne ("3-es", "5-es"), és az irányhatározós
 * "-hoz/-hez/-höz" alak is jegyenként eltér (pl. "a 3-ashoz", "az 5-öshöz"). */
const GRADE_WORD: Record<number, { suffix: string; toSuffix: string }> = {
  1: { suffix: "es", toSuffix: "eshez" },
  2: { suffix: "es", toSuffix: "eshez" },
  3: { suffix: "as", toSuffix: "ashoz" },
  4: { suffix: "es", toSuffix: "eshez" },
  5: { suffix: "ös", toSuffix: "öshöz" },
};

/** Érdemjegy megjelenítése helyes ragozással, pl. 3 → "3-as", 5 → "5-ös". */
export function formatGrade(jegy: number): string {
  return `${jegy}-${GRADE_WORD[jegy]?.suffix ?? "es"}`;
}

/** Érdemjegy irányhatározós ("-hoz/-hez/-höz") alakja, pl. 3 → "3-ashoz". */
export function formatGradeToSuffix(jegy: number): string {
  return `${jegy}-${GRADE_WORD[jegy]?.toSuffix ?? "eshez"}`;
}

/** Egy tétel pontjainak megjelenítése, pl. "12 / 20 pont", "12 pont", "max 20 pont". */
export function formatRequirementPont(
  szerzett: number | undefined,
  max: number | undefined
): string | null {
  if (typeof szerzett === "number" && typeof max === "number") return `${szerzett} / ${max} pont`;
  if (typeof szerzett === "number") return `${szerzett} pont`;
  if (typeof max === "number") return `max ${max} pont`;
  return null;
}
