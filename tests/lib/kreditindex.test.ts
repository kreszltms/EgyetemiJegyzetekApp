import { describe, expect, it } from "vitest";

import { computeKreditIndex } from "@/lib/kreditindex";
import type { Requirement, Subject } from "@/types";

function subject(partial: Partial<Subject> & { id: string }): Subject {
  return {
    semesterId: "sem1",
    nev: "Tárgy",
    kod: "T1",
    szin: "#000000",
    ikon: "BookOpen",
    oktato: { nev: "", email: "", fogadoora: "" },
    hianyzas: { maxHianyzas: 3, jelenlegiHianyzas: 0 },
    kovetelmenyek: [],
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...partial,
  };
}

function scoredReq(id: string, szerzett: number, max: number): Requirement {
  return { id, nev: id, tipus: "zh", teljesitve: false, pontszamSzerzett: szerzett, pontszamMax: max };
}

describe("computeKreditIndex", () => {
  it("üres tárgylistánál null átlagot és 0 összeget ad", () => {
    const result = computeKreditIndex([]);
    expect(result.average).toBeNull();
    expect(result.totalKredit).toBe(0);
    expect(result.earnedKredit).toBe(0);
  });

  it("kredit nélküli tárgy nem számít bele, még ha van is beírt pontja", () => {
    const s = subject({ id: "s1", kredit: undefined, kovetelmenyek: [scoredReq("r1", 95, 100)] });
    const result = computeKreditIndex([s]);
    expect(result.items[0].hasKredit).toBe(false);
    expect(result.items[0].included).toBe(false);
    expect(result.average).toBeNull();
  });

  it("beírt pont nélküli tárgy nem számít bele, még ha van is kreditje", () => {
    const s = subject({ id: "s1", kredit: 5, kovetelmenyek: [] });
    const result = computeKreditIndex([s]);
    expect(result.items[0].grade).toBeNull();
    expect(result.items[0].included).toBe(false);
    expect(result.average).toBeNull();
  });

  it("kredit-súlyozott átlagot számol a beszámítható tárgyakból", () => {
    // s1: 95/100 pont a default (59.5/69.5/79.5/89.5) beosztással -> 5-ös, 5 kredit
    // s2: 60/100 pont -> 2-es, 3 kredit
    // várt átlag: (5*5 + 2*3) / (5+3) = 31/8 = 3.875 -> 3.88 (2 tizedesre kerekítve)
    const s1 = subject({ id: "s1", kredit: 5, kovetelmenyek: [scoredReq("r1", 95, 100)] });
    const s2 = subject({ id: "s2", kredit: 3, kovetelmenyek: [scoredReq("r2", 60, 100)] });
    const result = computeKreditIndex([s1, s2]);
    expect(result.average).toBe(3.88);
    expect(result.totalKredit).toBe(8);
    expect(result.includedCount).toBe(2);
  });

  it("earnedKredit csak a legalább 2-es (nem elégtelen) tárgyak kreditjét számolja", () => {
    // s1: 10/100 pont -> 1-es (elégtelen) -> NEM jár kredit érte, de a
    // súlyozott átlagba (weightedSum/totalKredit) beleszámít.
    const s1 = subject({ id: "s1", kredit: 5, kovetelmenyek: [scoredReq("r1", 10, 100)] });
    const s2 = subject({ id: "s2", kredit: 4, kovetelmenyek: [scoredReq("r2", 95, 100)] });
    const result = computeKreditIndex([s1, s2]);
    expect(result.earnedKredit).toBe(4); // csak s2 kreditje
    expect(result.totalKredit).toBe(9); // s1 is beleszámít az átlagba
    expect(result.includedCount).toBe(2);
  });

  it("egyedi (tárgyra szabott) pontozási beosztást is figyelembe veszi", () => {
    const s = subject({
      id: "s1",
      kredit: 6,
      pontozas: { maxOsszpontszam: 50, hatarok: [{ jegy: 5, minPont: 30 }] },
      kovetelmenyek: [scoredReq("r1", 35, 50)],
    });
    const result = computeKreditIndex([s]);
    expect(result.items[0].grade).toBe(5);
    expect(result.average).toBe(5);
  });
});
