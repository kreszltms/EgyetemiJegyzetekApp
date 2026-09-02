import type { CalendarItem } from "@/lib/calendar-helpers";

// ============================================================================
// UNINOTES — .ics naptár export
// A buildCalendarItems() már egységesített listáját (órarend + nyitott,
// határidős követelmények) alakítja RFC5545 (iCalendar) szöveggé, hogy egy
// kattintással beimportálható legyen Google/Apple/Outlook naptárba.
// A tanórákat "lebegő" (időzóna-jelölő nélküli) helyi időként exportáljuk —
// a naptárapp a készülék saját időzónájában jeleníti meg, ami egy magyar
// egyetemistának megegyezik a valós órarenddel.
// ============================================================================

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function icsDateTimeLocal(d: Date): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(
    d.getHours()
  )}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

function icsDateOnly(dateKey: string): string {
  return dateKey.replaceAll("-", "");
}

function nextDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const next = new Date(y, (m ?? 1) - 1, (d ?? 1) + 1);
  return `${next.getFullYear()}${pad2(next.getMonth() + 1)}${pad2(next.getDate())}`;
}

function icsUtcStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(
    d.getUTCHours()
  )}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Kb. 75 karakteres soronkénti tördelés (RFC5545) — a legtöbb naptárapp
 * hosszú, tördeletlen sorral is elboldogul, de ez közelebb visz a szabványhoz. */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  let result = "";
  let current = "";
  for (const ch of line) {
    if (current.length === 75) {
      result += current + "\r\n";
      current = " ";
    }
    current += ch;
  }
  return result + current;
}

export function buildIcsCalendar(items: CalendarItem[]): string {
  const now = new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//UniNotes//HU",
    "CALSCALE:GREGORIAN",
  ];

  for (const item of items) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${item.id}@uninotes-app`);
    lines.push(`DTSTAMP:${icsUtcStamp(now)}`);

    if (item.kind === "hatarido") {
      lines.push(`DTSTART;VALUE=DATE:${icsDateOnly(item.dateKey)}`);
      lines.push(`DTEND;VALUE=DATE:${nextDateKey(item.dateKey)}`);
      const summary = item.subtitle ? `${item.subtitle} – ${item.cim}` : item.cim;
      lines.push(`SUMMARY:${escapeIcsText(summary)}`);
    } else {
      // "ora": a dateKey + sortTime (kezdés) és a timeLabel ("HH:MM–HH:MM")
      // alapján rekonstruáljuk a pontos kezdő/záró időpontot.
      const [y, m, d] = item.dateKey.split("-").map(Number);
      const [sh, sm] = item.sortTime.split(":").map(Number);
      const start = new Date(y, (m ?? 1) - 1, d ?? 1, sh ?? 0, sm ?? 0);
      let end = new Date(start.getTime() + 60 * 60 * 1000); // nincs végidő -> 1 óra
      const endLabel = item.timeLabel?.split("–")[1];
      if (endLabel) {
        const [eh, em] = endLabel.split(":").map(Number);
        end = new Date(y, (m ?? 1) - 1, d ?? 1, eh ?? 0, em ?? 0);
      }
      lines.push(`DTSTART:${icsDateTimeLocal(start)}`);
      lines.push(`DTEND:${icsDateTimeLocal(end)}`);
      lines.push(`SUMMARY:${escapeIcsText(item.cim)}`);
    }

    if (item.subtitle) {
      lines.push(`DESCRIPTION:${escapeIcsText(item.subtitle)}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** Letölti az .ics fájlt "uninotes-naptar-<dátum>.ics" néven. */
export function downloadIcsCalendar(items: CalendarItem[]) {
  const ics = buildIcsCalendar(items);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const datePart = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `uninotes-naptar-${datePart}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
