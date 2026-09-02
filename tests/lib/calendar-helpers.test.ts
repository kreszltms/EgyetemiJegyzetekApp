import { describe, expect, it } from "vitest";

import {
  buildCalendarItems,
  buildMonthMatrix,
  dateKeyFromDate,
  formatDateKeyHu,
  huMonthYearLabel,
  huWeekdayShort,
  timeLabelFromDate,
  todayDateKey,
  tomorrowDateKey,
} from "@/lib/calendar-helpers";
import type { ScheduleEvent, Subject } from "@/types";

function subject(partial: Partial<Subject> & { id: string }): Subject {
  return {
    semesterId: "sem1",
    nev: "Tárgy",
    kod: "T1",
    szin: "#123456",
    ikon: "BookOpen",
    oktato: { nev: "", email: "", fogadoora: "" },
    hianyzas: { maxHianyzas: 3, jelenlegiHianyzas: 0 },
    kovetelmenyek: [],
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...partial,
  };
}

function scheduleEvent(
  partial: Partial<ScheduleEvent> & { id: string }
): ScheduleEvent {
  return {
    cim: "Óra",
    tipus: "eloadas",
    kezdes: "2026-09-07T10:00:00",
    befejezes: "2026-09-07T11:30:00",
    ...partial,
  };
}

describe("dateKeyFromDate / timeLabelFromDate", () => {
  it("YYYY-MM-DD / HH:MM formátumot ad, nullákkal kitöltve", () => {
    const d = new Date(2026, 0, 5, 9, 3);
    expect(dateKeyFromDate(d)).toBe("2026-01-05");
    expect(timeLabelFromDate(d)).toBe("09:03");
  });
});

describe("huWeekdayShort / huMonthYearLabel", () => {
  it("körbefordul 7 naponta", () => {
    expect(huWeekdayShort(0)).toBe("H");
    expect(huWeekdayShort(6)).toBe("V");
    expect(huWeekdayShort(7)).toBe("H");
  });

  it("'ÉV. hónap' formátumot ad, kisbetűs hónapnévvel", () => {
    expect(huMonthYearLabel(new Date(2026, 7, 1))).toBe("2026. augusztus");
  });
});

describe("formatDateKeyHu", () => {
  it("a mai napra 'Ma'-t, a holnapira 'Holnap'-ot ad", () => {
    expect(formatDateKeyHu(todayDateKey())).toBe("Ma");
    expect(formatDateKeyHu(tomorrowDateKey())).toBe("Holnap");
  });

  it("egyéb dátumra tartalmazza az évet és a hónap nevét", () => {
    const result = formatDateKeyHu("2030-05-14");
    expect(result).toContain("2030");
    expect(result).toContain("május");
  });
});

describe("buildMonthMatrix", () => {
  it("42 napos rácsot ad, hétfővel kezdve és vasárnappal végződve", () => {
    const matrix = buildMonthMatrix(new Date(2026, 7, 15));
    expect(matrix).toHaveLength(42);
    expect(matrix[0].getDay()).toBe(1);
    expect(matrix[41].getDay()).toBe(0);
  });

  it("tartalmazza a hónap első napját", () => {
    const matrix = buildMonthMatrix(new Date(2026, 7, 15));
    const hasFirst = matrix.some(
      (d) => d.getFullYear() === 2026 && d.getMonth() === 7 && d.getDate() === 1
    );
    expect(hasFirst).toBe(true);
  });
});

describe("buildCalendarItems", () => {
  it("órarendi eseményből 'ora' típusú tételt épít, a tárgy színét feloldva", () => {
    const sub = subject({ id: "s1", nev: "Hálózatok", szin: "#ff0000" });
    const ev = scheduleEvent({ id: "e1", subjectId: "s1", cim: "Hálózatok" });
    const items = buildCalendarItems([ev], [sub]);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("ora");
    expect(items[0].szin).toBe("#ff0000");
    expect(items[0].timeLabel).toBe("10:00–11:30");
  });

  it("egyeztetetlen tárgyú órához semleges színt rendel", () => {
    const ev = scheduleEvent({ id: "e1" });
    const items = buildCalendarItems([ev], []);
    expect(items[0].szin).toBe("#94a3b8");
  });

  it("24 órán át tartó, éjfélkor kezdődő eseményt egész naposnak jelöl", () => {
    const ev = scheduleEvent({
      id: "e1",
      kezdes: "2026-09-07T00:00:00",
      befejezes: "2026-09-08T00:00:00",
    });
    const items = buildCalendarItems([ev], []);
    expect(items[0].timeLabel).toBe("Egész nap");
  });

  it("csak a nyitott (nem teljesített), határidős követelményekből épít 'hatarido' tételt", () => {
    const sub = subject({
      id: "s1",
      nev: "Adatbázisok",
      kovetelmenyek: [
        { id: "r1", nev: "ZH1", tipus: "zh", teljesitve: false, hatarido: "2026-10-01" },
        { id: "r2", nev: "ZH2", tipus: "zh", teljesitve: true, hatarido: "2026-10-02" },
        { id: "r3", nev: "Beadandó", tipus: "beadando", teljesitve: false },
      ],
    });
    const items = buildCalendarItems([], [sub]);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("hatarido");
    expect(items[0].id).toBe("r1");
    expect(items[0].szin).toBe("#ef4444");
  });

  it("dátum szerint rendezi a vegyes (óra + határidő) tételeket", () => {
    const sub = subject({
      id: "s1",
      kovetelmenyek: [
        { id: "r1", nev: "ZH", tipus: "zh", teljesitve: false, hatarido: "2026-09-01" },
      ],
    });
    const ev = scheduleEvent({
      id: "e1",
      kezdes: "2026-09-02T08:00:00",
      befejezes: "2026-09-02T09:00:00",
    });
    const items = buildCalendarItems([ev], [sub]);
    expect(items.map((i) => i.id)).toEqual(["r1", "e1"]);
  });

  it("azonos napon idő szerint rendezi a tételeket", () => {
    const ev1 = scheduleEvent({
      id: "late",
      kezdes: "2026-09-02T14:00:00",
      befejezes: "2026-09-02T15:00:00",
    });
    const ev2 = scheduleEvent({
      id: "early",
      kezdes: "2026-09-02T08:00:00",
      befejezes: "2026-09-02T09:00:00",
    });
    const items = buildCalendarItems([ev1, ev2], []);
    expect(items.map((i) => i.id)).toEqual(["early", "late"]);
  });
});
