import type { ParsedScheduleEvent } from "@/lib/neptun-xlsx";

// ============================================================================
// UNINOTES — .ics naptár import
// A lib/ics-export.ts buildIcsCalendar()-jának visszafelé iránya: egy
// külső .ics fájlt (pl. egyetemi/hallgatói naptárból) olvas be, és a benne
// lévő VEVENT-eket ScheduleEvent-té alakítja, hogy a Naptár nézetben és az
// órarendben is megjelenjenek.
//
// Korlátok (a lehető legegyszerűbb, függőség nélküli implementáció miatt):
// - Az időzóna-jelölőket (TZID) nem értelmezzük — a dátum/idő értékeket
//   lebegő helyi időként kezeljük, a "Z" (UTC) jelölésű időpontokat pedig a
//   böngésző saját (helyi) időzónájára váltjuk át. Magyar egyetemi
//   naptáraknál ez a gyakorlatban helyes eredményt ad.
// - Ismétlődő eseményeket (RRULE) nem bontjuk ki — csak az egyszeri
//   előfordulást importáljuk, ahogy a fájlban szerepel.
// ============================================================================

export type IcsImportResult =
  | { success: true; events: ParsedScheduleEvent[] }
  | { success: false; error: string };

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function localIso(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** Feloldja az RFC5545 sortördelést: a folytatósorok szóközzel/tabbal
 * kezdődnek, ezeket az előző sorhoz kell fűzni. */
function unfoldLines(raw: string): string[] {
  const rawLines = raw.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else if (line.trim() !== "") {
      lines.push(line);
    }
  }
  return lines;
}

function unescapeIcsText(text: string): string {
  return text
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

interface ParsedProperty {
  name: string;
  params: Record<string, string>;
  value: string;
}

function parseLine(line: string): ParsedProperty {
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) return { name: line, params: {}, value: "" };
  const head = line.slice(0, colonIndex);
  const value = line.slice(colonIndex + 1);
  const [name, ...paramParts] = head.split(";");
  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return { name: name.toUpperCase(), params, value };
}

/** "YYYYMMDD" vagy "YYYYMMDDTHHMMSS(Z)?" -> helyi Date objektum. */
function parseIcsDateValue(value: string, isUtc: boolean): Date | null {
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const dateTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(value);
  if (dateTime) {
    const [, y, m, d, h, mi, s, z] = dateTime;
    if (z || isUtc) {
      return new Date(
        Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h), Number(mi), Number(s))
      );
    }
    return new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(mi), Number(s));
  }
  return null;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export async function parseIcsFile(file: File): Promise<IcsImportResult> {
  let raw: string;
  try {
    raw = await file.text();
  } catch {
    return { success: false, error: "Nem sikerült beolvasni a fájlt." };
  }

  if (!raw.includes("BEGIN:VCALENDAR")) {
    return { success: false, error: "A fájl nem tűnik érvényes .ics naptárfájlnak." };
  }

  const lines = unfoldLines(raw);
  const events: ParsedScheduleEvent[] = [];

  let current: Record<string, ParsedProperty> | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current) {
        const event = buildEventFromProperties(current);
        if (event) events.push(event);
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const prop = parseLine(line);
    current[prop.name] = prop;
  }

  if (events.length === 0) {
    return { success: false, error: "A fájlban nem található importálható esemény." };
  }

  return { success: true, events };
}

function buildEventFromProperties(
  props: Record<string, ParsedProperty>
): ParsedScheduleEvent | null {
  const dtstart = props["DTSTART"];
  if (!dtstart) return null;

  const isAllDay = dtstart.params["VALUE"] === "DATE" || /^\d{8}$/.test(dtstart.value);
  const isUtcStart = dtstart.value.endsWith("Z");
  const start = parseIcsDateValue(dtstart.value, isUtcStart);
  if (!start) return null;

  const summaryProp = props["SUMMARY"];
  const cim = summaryProp ? unescapeIcsText(summaryProp.value) : "Névtelen esemény";
  const locationProp = props["LOCATION"];

  let kezdes: string;
  let befejezes: string;

  if (isAllDay) {
    const dtendProp = props["DTEND"];
    let lastDay = start;
    if (dtendProp) {
      const end = parseIcsDateValue(dtendProp.value, false);
      if (end) {
        // A DTEND egésznapos eseményeknél kizárólagos (a rákövetkező nap
        // éjfele) — az utolsó ténylegesen érintett nap az előtte lévő nap.
        lastDay = addDays(end, -1);
        if (lastDay.getTime() < start.getTime()) lastDay = start;
      }
    }
    kezdes = `${localIso(start).slice(0, 10)}T00:00:00`;
    befejezes = `${localIso(lastDay).slice(0, 10)}T23:59:00`;
  } else {
    const dtendProp = props["DTEND"];
    const isUtcEnd = dtendProp?.value.endsWith("Z") ?? isUtcStart;
    const end = dtendProp
      ? parseIcsDateValue(dtendProp.value, isUtcEnd)
      : new Date(start.getTime() + 60 * 60 * 1000);
    kezdes = localIso(start);
    befejezes = localIso(end ?? new Date(start.getTime() + 60 * 60 * 1000));
  }

  return {
    cim,
    tipus: "egyeb",
    kezdes,
    befejezes,
    terem: locationProp ? unescapeIcsText(locationProp.value) : undefined,
  };
}
