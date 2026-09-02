import { describe, expect, it } from "vitest";

import {
  calculateGrade,
  formatGrade,
  formatGradeToSuffix,
  formatRequirementPont,
  summarizePontozas,
} from "@/lib/pontozas";
import { DEFAULT_PONTOZAS } from "@/types";
import type { Requirement } from "@/types";

// Alap 59.5/69.5/79.5/89.5 pontos jegyhatár-beosztás (lásd types/index.ts
// DEFAULT_PONTOZAS) — ugyanaz, amit a legtöbb tárgy alapértelmezésként kap.
const HATAROK = DEFAULT_PONTOZAS.hatarok;

function req(partial: Partial<Requirement>): Requirement {
  return {
    id: partial.id ?? "r",
    nev: partial.nev ?? "Tétel",
    tipus: partial.tipus ?? "zh",
    teljesitve: partial.teljesitve ?? false,
    ...partial,
  };
}

describe("calculateGrade", () => {
  it("elégtelent (1) ad, ha egyetlen határt sem ér el a pontszám", () => {
    expect(calculateGrade(10, HATAROK)).toBe(1);
    expect(calculateGrade(59.4, HATAROK)).toBe(1);
  });

  it("a határon PONTOSAN a magasabb jegyet adja (>=, nem >)", () => {
    expect(calculateGrade(59.5, HATAROK)).toBe(2);
    expect(calculateGrade(89.5, HATAROK)).toBe(5);
  });

  it("a legmagasabb elért határ jegyét adja, nem csak az elsőt", () => {
    expect(calculateGrade(95, HATAROK)).toBe(5);
    expect(calculateGrade(75, HATAROK)).toBe(3);
  });

  it("rendezetlen bemeneti hatarok tömbbel is helyesen működik", () => {
    const shuffled = [...HATAROK].reverse();
    expect(calculateGrade(70, shuffled)).toBe(3);
  });
});

describe("summarizePontozas", () => {
  it("nincs beírt pont esetén 1-es a currentGrade, és jelzi a hátralévő tételeket", () => {
    const result = summarizePontozas(
      [req({ id: "1", pontszamMax: 20 }), req({ id: "2", pontszamMax: 30 })],
      undefined
    );
    expect(result.currentGrade).toBe(1);
    expect(result.totalSzerzett).toBe(0);
    expect(result.hasUnscoredItems).toBe(true);
    expect(result.remainingMax).toBe(50);
  });

  it("csak a beírt pontszámok összegződnek totalSzerzett-be", () => {
    const result = summarizePontozas(
      [
        req({ id: "1", pontszamSzerzett: 18, pontszamMax: 20 }),
        req({ id: "2", pontszamMax: 30 }), // még nincs beírva
      ],
      undefined
    );
    expect(result.totalSzerzett).toBe(18);
    expect(result.remainingMax).toBe(30); // csak a MÉG NEM osztályozott tétel max pontja
    expect(result.hasUnscoredItems).toBe(true);
  });

  it("kiszámolja a következő jegyhez szükséges pontot és annak elérhetőségét", () => {
    // 55 pont -> 2-eshez (59.5) még 4.5 pont kell; a hátralévő tétel 30 pontot ér -> elérhető
    const result = summarizePontozas(
      [
        req({ id: "1", pontszamSzerzett: 55, pontszamMax: 60 }),
        req({ id: "2", pontszamMax: 30 }),
      ],
      undefined
    );
    expect(result.nextGrade).toBe(2);
    expect(result.pointsNeededForNextGrade).toBe(4.5);
    expect(result.nextGradeReachable).toBe(true);
  });

  it("nextGradeReachable = false, ha a hátralévő max pont nem elég a következő jegyhez", () => {
    // 55 pont, minden más tétel már osztályozva -> nincs remainingMax, de van
    // következő jegy (2-es, 59.5-nél) — ez sosem érhető el, mert 0 pont marad.
    const result = summarizePontozas(
      [req({ id: "1", pontszamSzerzett: 55, pontszamMax: 60 })],
      undefined
    );
    expect(result.nextGrade).toBe(2);
    expect(result.nextGradeReachable).toBe(false);
  });

  it("5-ösnél (legmagasabb jegy) nincs nextGrade", () => {
    const result = summarizePontozas(
      [req({ id: "1", pontszamSzerzett: 95, pontszamMax: 100 })],
      undefined
    );
    expect(result.currentGrade).toBe(5);
    expect(result.nextGrade).toBeNull();
    expect(result.pointsNeededForNextGrade).toBeNull();
  });

  it("egyedi (tárgyra szabott) pontozási beosztást használ, ha meg van adva", () => {
    const customPontozas = {
      maxOsszpontszam: 100,
      hatarok: [{ jegy: 5, minPont: 40 }], // szokatlanul alacsony küszöb
    };
    const result = summarizePontozas(
      [req({ id: "1", pontszamSzerzett: 45, pontszamMax: 100 })],
      customPontozas
    );
    expect(result.currentGrade).toBe(5);
  });
});

describe("formatGrade / formatGradeToSuffix — magyar jegyragozás", () => {
  it.each([
    [1, "1-es", "1-eshez"],
    [2, "2-es", "2-eshez"],
    [3, "3-as", "3-ashoz"],
    [4, "4-es", "4-eshez"],
    [5, "5-ös", "5-öshöz"],
  ])("jegy=%i -> formatGrade=%s, formatGradeToSuffix=%s", (jegy, expected, expectedSuffix) => {
    expect(formatGrade(jegy)).toBe(expected);
    expect(formatGradeToSuffix(jegy)).toBe(expectedSuffix);
  });
});

describe("formatRequirementPont", () => {
  it("mindkét érték esetén 'szerzett / max pont' formátumot ad", () => {
    expect(formatRequirementPont(12, 20)).toBe("12 / 20 pont");
  });
  it("csak szerzett pont esetén 'szerzett pont' formátumot ad", () => {
    expect(formatRequirementPont(12, undefined)).toBe("12 pont");
  });
  it("csak max pont esetén 'max X pont' formátumot ad", () => {
    expect(formatRequirementPont(undefined, 20)).toBe("max 20 pont");
  });
  it("egyik érték hiányában sem null-t ad", () => {
    expect(formatRequirementPont(undefined, undefined)).toBeNull();
  });
});
