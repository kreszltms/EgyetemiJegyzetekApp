import { describe, expect, it } from "vitest";

import type { CalendarItem } from "@/lib/calendar-helpers";
import { buildIcsCalendar } from "@/lib/ics-export";
import { parseIcsFile } from "@/lib/ics-import";

function makeFile(content: string, name = "naptar.ics"): File {
  return new File([content], name, { type: "text/calendar" });
}

describe("buildIcsCalendar", () => {
  it("VCALENDAR/VEVENT blokkokat épít, UniNotes PRODID-dal és UID-dal", () => {
    const item: CalendarItem = {
      id: "abc",
      kind: "ora",
      cim: "Hálózatok",
      dateKey: "2026-09-07",
      timeLabel: "10:00–11:30",
      sortTime: "10:00",
      szin: "#000000",
    };
    const ics = buildIcsCalendar([item]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("PRODID:-//UniNotes//HU");
    expect(ics).toContain("UID:abc@uninotes-app");
    expect(ics).toContain("SUMMARY:Hálózatok");
    expect(ics).toContain("DTSTART:20260907T100000");
    expect(ics).toContain("DTEND:20260907T113000");
  });

  it("határidős tételt egész napos (VALUE=DATE) eseményként exportál, a rákövetkező napi DTEND-del", () => {
    const item: CalendarItem = {
      id: "r1",
      kind: "hatarido",
      cim: "ZH",
      dateKey: "2026-10-01",
      sortTime: "00:00",
      subtitle: "Zárthelyi · Matek",
      szin: "#ef4444",
    };
    const ics = buildIcsCalendar([item]);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261001");
    expect(ics).toContain("DTEND;VALUE=DATE:20261002");
    expect(ics).toContain("SUMMARY:Zárthelyi · Matek – ZH");
  });

  it("escape-eli a vesszőt/pontosvesszőt/backslash-t a szövegmezőkben", () => {
    const item: CalendarItem = {
      id: "r2",
      kind: "hatarido",
      cim: "A, B; C\\D",
      dateKey: "2026-10-01",
      sortTime: "00:00",
      szin: "#ef4444",
    };
    const ics = buildIcsCalendar([item]);
    expect(ics).toContain("A\\, B\\; C\\\\D");
  });
});

describe("parseIcsFile — buildIcsCalendar kör-út", () => {
  it("visszaadja a beépített órarendi eseményt (cím, kezdés, befejezés) importként", async () => {
    const item: CalendarItem = {
      id: "abc",
      kind: "ora",
      cim: "Hálózatok",
      dateKey: "2026-09-07",
      timeLabel: "10:00–11:30",
      sortTime: "10:00",
      szin: "#000000",
      subtitle: "Előadás · Terem 5",
    };
    const ics = buildIcsCalendar([item]);
    const result = await parseIcsFile(makeFile(ics));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.events).toHaveLength(1);
    expect(result.events[0].cim).toBe("Hálózatok");
    expect(result.events[0].kezdes).toBe("2026-09-07T10:00:00");
    expect(result.events[0].befejezes).toBe("2026-09-07T11:30:00");
  });

  it("egész napos (VALUE=DATE) határidő-eseményt egy teljes napra importál vissza", async () => {
    const item: CalendarItem = {
      id: "r1",
      kind: "hatarido",
      cim: "ZH",
      dateKey: "2026-10-01",
      sortTime: "00:00",
      szin: "#ef4444",
    };
    const ics = buildIcsCalendar([item]);
    const result = await parseIcsFile(makeFile(ics));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.events[0].kezdes).toBe("2026-10-01T00:00:00");
    expect(result.events[0].befejezes).toBe("2026-10-01T23:59:00");
  });

  it("hibát ad, ha a fájl nem tartalmaz BEGIN:VCALENDAR-t", async () => {
    const result = await parseIcsFile(makeFile("nem naptár fájl"));
    expect(result.success).toBe(false);
  });

  it("hibát ad, ha nincs importálható esemény a fájlban", async () => {
    const result = await parseIcsFile(
      makeFile("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n")
    );
    expect(result.success).toBe(false);
  });
});
