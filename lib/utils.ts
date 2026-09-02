import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn/ui szabvány class-merge helper */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Egyszerű, függőség nélküli egyedi azonosító generátor (UUID v4-szerű) */
export function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** ISO dátum → magyar formátum, pl. "2026. 08. 31." */
export function formatDateHu(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("hu-HU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** ISO dátum-idő → magyar formátum, pl. "2026. 08. 31. 14:05" */
export function formatDateTimeHu(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("hu-HU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Mai dátum ISO (YYYY-MM-DD) formátumban, input[type=date]-hez */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Szöveges bevitelből kinyeri a "#cimke" formájú hashtageket,
 * és normalizált (kisbetűs, "#" nélküli) tömbként adja vissza.
 */
export function parseTags(input: string): string[] {
  const matches = input.match(/#([^\s#,]+)/g) ?? [];
  const fromHash = matches.map((m) => m.slice(1).toLowerCase());
  // A vesszős lista csak akkor számít külön forrásnak, ha az input tényleg
  // vesszőt tartalmaz — enélkül a szóközzel elválasztott "#tag1 #tag2"
  // bevitel a teljes szöveget egyetlen (hibás, "#"-t is tartalmazó) tagként
  // adná hozzá a fromHash mellé.
  const fromCommaList = input.includes(",")
    ? input
        .split(",")
        .map((s) => s.trim().replace(/^#/, "").toLowerCase())
        .filter((s) => s && !s.includes(" ") && !s.includes("#"))
    : [];
  return Array.from(new Set([...fromHash, ...fromCommaList])).filter(Boolean);
}

/** Százalékos befejezettség kiszámítása (0–100) */
export function calcPercentage(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

/** Hiányzás státusz szöveg + szín kategória a UI-hoz */
export function attendanceStatus(current: number, max: number): {
  label: string;
  variant: "ok" | "warning" | "danger";
} {
  if (max <= 0) return { label: "Nincs korlát", variant: "ok" };
  const ratio = current / max;
  if (current > max) return { label: "Túllépve", variant: "danger" };
  if (ratio >= 0.75) return { label: "Figyelmeztetés", variant: "warning" };
  return { label: "Rendben", variant: "ok" };
}
