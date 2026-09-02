import { describe, expect, it } from "vitest";

import {
  attendanceStatus,
  calcPercentage,
  formatDateHu,
  formatDateTimeHu,
  generateId,
  parseTags,
  todayIso,
} from "@/lib/utils";

describe("parseTags", () => {
  it("kinyeri a #cimke formátumú hashtageket, kisbetűsítve", () => {
    expect(parseTags("Ez egy #Fontos #vizsgakérdés szöveg")).toEqual([
      "fontos",
      "vizsgakérdés",
    ]);
  });

  it("vesszős listát is elfogad, ha van vessző a bemenetben", () => {
    expect(parseTags("fontos, vizsga, definíció")).toEqual([
      "fontos",
      "vizsga",
      "definíció",
    ]);
  });

  it("duplikátumokat kiszűri (kis- és nagybetűtől függetlenül)", () => {
    expect(parseTags("#fontos #Fontos")).toEqual(["fontos"]);
  });

  it("hashtag/vessző nélküli szövegre üres tömböt ad", () => {
    expect(parseTags("nincs itt semmi cimke")).toEqual([]);
  });
});

describe("calcPercentage", () => {
  it("kerekített százalékot ad", () => {
    expect(calcPercentage(1, 3)).toBe(33);
    expect(calcPercentage(2, 3)).toBe(67);
    expect(calcPercentage(10, 10)).toBe(100);
  });

  it("0 vagy negatív total esetén 0-t ad, sosem oszt nullával", () => {
    expect(calcPercentage(5, 0)).toBe(0);
    expect(calcPercentage(5, -1)).toBe(0);
  });
});

describe("attendanceStatus", () => {
  it("korlát nélkül (max<=0) mindig 'Nincs korlát' / ok", () => {
    expect(attendanceStatus(10, 0)).toEqual({ label: "Nincs korlát", variant: "ok" });
  });

  it("'Túllépve' / danger, ha a jelenlegi meghaladja a maxot", () => {
    expect(attendanceStatus(4, 3)).toEqual({ label: "Túllépve", variant: "danger" });
  });

  it("figyelmeztet (warning), ha a hiányzás eléri a 75%-ot, de nem lépi túl", () => {
    expect(attendanceStatus(3, 4).variant).toBe("warning");
  });

  it("rendben (ok), ha alacsony a hiányzás aránya", () => {
    expect(attendanceStatus(1, 4).variant).toBe("ok");
  });
});

describe("formatDateHu / formatDateTimeHu", () => {
  it("undefined vagy érvénytelen bemenetre üres stringet ad", () => {
    expect(formatDateHu(undefined)).toBe("");
    expect(formatDateHu("nem-datum")).toBe("");
    expect(formatDateTimeHu(undefined)).toBe("");
    expect(formatDateTimeHu("nem-datum")).toBe("");
  });

  it("érvényes ISO dátumból az évet tartalmazó, tagolt stringet ad", () => {
    const result = formatDateHu("2026-08-31");
    expect(result).toContain("2026");
    expect(result.length).toBeGreaterThan(4);
  });

  it("érvényes ISO dátum-időből az évet és a formázott időt is tartalmazza", () => {
    const result = formatDateTimeHu("2026-08-31T14:05:00");
    expect(result).toContain("2026");
    expect(result).toMatch(/\d{2}:\d{2}/);
  });
});

describe("todayIso / generateId", () => {
  it("todayIso 'YYYY-MM-DD' formátumú stringet ad", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("generateId egyedi, nem üres azonosítókat ad", () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });
});
