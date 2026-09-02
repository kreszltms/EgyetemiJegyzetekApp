import { NOTE_CATEGORY_LABELS, REQUIREMENT_TYPE_LABELS } from "@/types";
import type { RequirementType, ScheduleEvent, Subject } from "@/types";

// ============================================================================
// EGYETEMI JEGYZETEK — Naptár segédfüggvények
// Egységes "CalendarItem" formára hozza az importált órarendi eseményeket
// (Neptun) és a tárgyakhoz felvett, még nyitott ZH/vizsga/beadandó
// határidőket, hogy a havi rács és a lista nézet ugyanazt a formát
// használhassa.
// ============================================================================

export interface CalendarItem {
  id: string;
  kind: "ora" | "hatarido";
  cim: string;
  /** Helyi naptári nap "YYYY-MM-DD" formában — időzóna-biztos csoportosításhoz */
  dateKey: string;
  /** "12:00–13:30" tanórához; határidőnél üres (egész napos) */
  timeLabel?: string;
  /** Rendezéshez: "HH:MM", határidőnél "00:00" (a nap elején jelenik meg) */
  sortTime: string;
  subtitle?: string;
  szin: string;
  subjectId?: string;
  requirementType?: RequirementType;
}

const NEUTRAL_COLOR = "#94a3b8"; // slate-400 — nem egyeztetett tárgyú óra
const DEADLINE_COLOR = "#ef4444"; // red-500 — határidők kiemelése

const pad2 = (n: number) => String(n).padStart(2, "0");

export function dateKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function timeLabelFromDate(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function todayDateKey(): string {
  return dateKeyFromDate(new Date());
}

export function tomorrowDateKey(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return dateKeyFromDate(d);
}

const HU_WEEKDAY_LONG = [
  "hétfő",
  "kedd",
  "szerda",
  "csütörtök",
  "péntek",
  "szombat",
  "vasárnap",
];

/** "YYYY-MM-DD" -> "2026. szeptember 7., hétfő" (vagy "Ma" / "Holnap") */
export function formatDateKeyHu(dateKey: string): string {
  if (dateKey === todayDateKey()) return "Ma";
  if (dateKey === tomorrowDateKey()) return "Holnap";
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  const weekday = HU_WEEKDAY_LONG[(date.getDay() + 6) % 7];
  return `${y}. ${HU_MONTH_LABELS[(m ?? 1) - 1].toLowerCase()} ${d}., ${weekday}`;
}

const HU_WEEKDAY_SHORT = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];
const HU_MONTH_LABELS = [
  "Január",
  "Február",
  "Március",
  "Április",
  "Május",
  "Június",
  "Július",
  "Augusztus",
  "Szeptember",
  "Október",
  "November",
  "December",
];

export function huWeekdayShort(mondayIndex: number): string {
  return HU_WEEKDAY_SHORT[mondayIndex % 7];
}

export function huMonthYearLabel(monthDate: Date): string {
  return `${monthDate.getFullYear()}. ${HU_MONTH_LABELS[monthDate.getMonth()].toLowerCase()}`;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** 6×7 = 42 napos rács a hónaphoz, hétfővel kezdve, az előző/követő hónap
 * napjaival kitöltve. */
export function buildMonthMatrix(monthDate: Date): Date[] {
  const first = startOfMonth(monthDate);
  const jsDay = first.getDay(); // 0 = vasárnap .. 6 = szombat
  const mondayOffset = (jsDay + 6) % 7;
  const gridStart = addDays(first, -mondayOffset);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

/** Az importált órarendet és a nyitott, határidős követelményeket egységes
 * CalendarItem listává alakítja, a tárgy nevét/színét feloldva. */
export function buildCalendarItems(
  scheduleEvents: ScheduleEvent[],
  subjects: Subject[]
): CalendarItem[] {
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const items: CalendarItem[] = [];

  for (const ev of scheduleEvents) {
    const start = new Date(ev.kezdes);
    const end = new Date(ev.befejezes);
    if (Number.isNaN(start.getTime())) continue;
    const subject = ev.subjectId ? subjectById.get(ev.subjectId) : undefined;
    const roomAndTeacher = [ev.terem, ev.oktato].filter(Boolean).join(" · ");
    items.push({
      id: ev.id,
      kind: "ora",
      cim: ev.cim,
      dateKey: dateKeyFromDate(start),
      timeLabel: Number.isNaN(end.getTime())
        ? timeLabelFromDate(start)
        : `${timeLabelFromDate(start)}–${timeLabelFromDate(end)}`,
      sortTime: timeLabelFromDate(start),
      subtitle: [NOTE_CATEGORY_LABELS[ev.tipus], roomAndTeacher].filter(Boolean).join(" · "),
      szin: subject?.szin ?? NEUTRAL_COLOR,
      subjectId: ev.subjectId,
    });
  }

  for (const subject of subjects) {
    for (const req of subject.kovetelmenyek) {
      if (req.teljesitve || !req.hatarido) continue;
      items.push({
        id: req.id,
        kind: "hatarido",
        cim: req.nev,
        dateKey: req.hatarido,
        sortTime: "00:00",
        subtitle: `${REQUIREMENT_TYPE_LABELS[req.tipus]} · ${subject.nev}`,
        szin: DEADLINE_COLOR,
        subjectId: subject.id,
        requirementType: req.tipus,
      });
    }
  }

  return items.sort((a, b) =>
    a.dateKey === b.dateKey ? a.sortTime.localeCompare(b.sortTime) : a.dateKey.localeCompare(b.dateKey)
  );
}
