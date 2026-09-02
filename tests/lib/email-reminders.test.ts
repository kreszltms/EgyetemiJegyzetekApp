import { describe, expect, it } from "vitest";

import {
  buildReminderEmailHtml,
  buildReminderEmailSubject,
  computeDueReminders,
  type DueReminderItem,
} from "@/lib/email-reminders";
import type { Requirement, Subject } from "@/types";

function subject(
  partial: Partial<Subject> & { id: string; kovetelmenyek: Requirement[] }
): Subject {
  return {
    semesterId: "sem1",
    nev: "Tárgy",
    kod: "T1",
    szin: "#000000",
    ikon: "BookOpen",
    oktato: { nev: "", email: "", fogadoora: "" },
    hianyzas: { maxHianyzas: 3, jelenlegiHianyzas: 0 },
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...partial,
  };
}

function req(partial: Partial<Requirement> & { id: string }): Requirement {
  return {
    nev: "Tétel",
    tipus: "zh",
    teljesitve: false,
    ...partial,
  };
}

describe("computeDueReminders", () => {
  it("csak a még nem teljesített, határidős zh/vizsga tételeket veszi figyelembe", () => {
    const s = subject({
      id: "s1",
      kovetelmenyek: [
        req({ id: "r1", tipus: "zh", hatarido: "2026-09-05" }),
        req({ id: "r2", tipus: "beadando", hatarido: "2026-09-05" }),
        req({ id: "r3", tipus: "zh", hatarido: "2026-09-05", teljesitve: true }),
        req({ id: "r4", tipus: "zh" }),
      ],
    });
    const { items } = computeDueReminders([s], 7, "2026-09-02", []);
    expect(items).toHaveLength(1);
    expect(items[0].key).toBe("r1:2026-09-05");
  });

  it("csak a napokElotte ablakon belül esedékes tételeket adja vissza, a lejártakat és a túl távoliakat nem", () => {
    const s = subject({
      id: "s1",
      kovetelmenyek: [
        req({ id: "past", tipus: "vizsga", hatarido: "2026-09-01" }),
        req({ id: "today", tipus: "vizsga", hatarido: "2026-09-02" }),
        req({ id: "soon", tipus: "vizsga", hatarido: "2026-09-05" }),
        req({ id: "far", tipus: "vizsga", hatarido: "2026-09-20" }),
      ],
    });
    const { items } = computeDueReminders([s], 3, "2026-09-02", []);
    expect(items.map((i) => i.key)).toEqual(["today:2026-09-02", "soon:2026-09-05"]);
    expect(items[0].napokMulva).toBe(0);
    expect(items[1].napokMulva).toBe(3);
  });

  it("kihagyja a már elküldött (alreadySentKeys-ben szereplő) tételeket", () => {
    const s = subject({
      id: "s1",
      kovetelmenyek: [req({ id: "r1", tipus: "zh", hatarido: "2026-09-02" })],
    });
    const { items, newKeys } = computeDueReminders([s], 5, "2026-09-02", ["r1:2026-09-02"]);
    expect(items).toHaveLength(0);
    expect(newKeys).toHaveLength(0);
  });

  it("a legközelebbi határidőt adja vissza elsőként (növekvő napokMulva szerint rendezve)", () => {
    const s = subject({
      id: "s1",
      kovetelmenyek: [
        req({ id: "a", tipus: "zh", hatarido: "2026-09-06" }),
        req({ id: "b", tipus: "zh", hatarido: "2026-09-03" }),
      ],
    });
    const { items } = computeDueReminders([s], 10, "2026-09-02", []);
    expect(items.map((i) => i.key)).toEqual(["b:2026-09-03", "a:2026-09-06"]);
  });
});

describe("buildReminderEmailHtml / buildReminderEmailSubject", () => {
  it("a HTML tartalmazza a tétel és a tárgy nevét, HTML-escape-elve", () => {
    const items: DueReminderItem[] = [
      {
        key: "r1:2026-09-02",
        subjectNev: "Programozás <1>",
        requirement: req({ id: "r1", tipus: "zh", nev: "ZH & <fontos>", hatarido: "2026-09-02" }),
        napokMulva: 0,
      },
    ];
    const html = buildReminderEmailHtml(items);
    expect(html).toContain("ZH &amp; &lt;fontos&gt;");
    expect(html).toContain("Programozás &lt;1&gt;");
    expect(html).toContain("ma esedékes");
  });

  it("holnapra és több napra eltérő szöveget ad", () => {
    const base = { subjectNev: "T", requirement: req({ id: "r", tipus: "zh", hatarido: "x" }) };
    expect(
      buildReminderEmailHtml([{ ...base, key: "k1", napokMulva: 1 }])
    ).toContain("holnap esedékes");
    expect(
      buildReminderEmailHtml([{ ...base, key: "k2", napokMulva: 4 }])
    ).toContain("4 nap múlva esedékes");
  });

  it("egy tételnél a tétel nevét, többnél a darabszámot írja a tárgysorba", () => {
    const one: DueReminderItem[] = [
      {
        key: "k1",
        subjectNev: "T",
        requirement: req({ id: "r1", tipus: "zh", nev: "Nagy ZH", hatarido: "x" }),
        napokMulva: 0,
      },
    ];
    expect(buildReminderEmailSubject(one)).toBe("Közelgő határidő: Nagy ZH");

    const two: DueReminderItem[] = [
      ...one,
      {
        key: "k2",
        subjectNev: "T",
        requirement: req({ id: "r2", tipus: "zh", hatarido: "x" }),
        napokMulva: 1,
      },
    ];
    expect(buildReminderEmailSubject(two)).toBe("2 közelgő határidő az UniNotesben");
  });
});
