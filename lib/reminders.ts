"use client";

import type { CalendarItem } from "@/lib/calendar-helpers";
import { todayDateKey, tomorrowDateKey } from "@/lib/calendar-helpers";

// ============================================================================
// UNINOTES — Emlékeztetők (böngésző Notification API)
// Mivel ez egy 100%-ban kliensoldali, backend nélküli app, nincs push
// szerver — az emlékeztető csak akkor tud megjelenni, ha az app tényleg meg
// van nyitva (vagy fókuszba kerül) a böngészőben / telepített PWA-ként.
// Ezért minden alkalommal, amikor az app betöltődik vagy fókuszba kerül,
// megnézzük, van-e ma/holnap esedékes, még nyitott határidő, és ha igen (és
// a felhasználó ÉS a böngésző is engedélyezte az értesítéseket), naponta
// legfeljebb egyszer küldünk emlékeztetőt tételenként (localStorage-ban
// nyilvántartva, hogy ma melyikre már küldtünk).
// ============================================================================

// FONTOS: ezek a kulcsok is szándékosan maradtak a régi néven — lásd a
// magyarázatot a lib/store.ts STORAGE_KEY-nél. A felhasználó eddigi
// emlékeztető-beállítása (be/ki + a "ma már küldtem erre" napló) így nem
// veszik el az UniNotes átnevezés után sem.
const ENABLED_KEY = "egyetemi-jegyzetek-emlekeztetok-enabled";
const NOTIFIED_KEY = "egyetemi-jegyzetek-emlekeztetok-kikuldve";

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return "denied";
  return Notification.requestPermission();
}

export function areRemindersEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(ENABLED_KEY) === "1";
}

export function setRemindersEnabled(value: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ENABLED_KEY, value ? "1" : "0");
}

interface NotifiedLog {
  dateKey: string;
  ids: string[];
}

function readNotifiedLog(): NotifiedLog {
  if (typeof window === "undefined") return { dateKey: "", ids: [] };
  try {
    const raw = window.localStorage.getItem(NOTIFIED_KEY);
    if (!raw) return { dateKey: "", ids: [] };
    const parsed = JSON.parse(raw) as Partial<NotifiedLog>;
    if (typeof parsed.dateKey !== "string" || !Array.isArray(parsed.ids)) {
      return { dateKey: "", ids: [] };
    }
    return { dateKey: parsed.dateKey, ids: parsed.ids };
  } catch {
    return { dateKey: "", ids: [] };
  }
}

function writeNotifiedLog(log: NotifiedLog) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NOTIFIED_KEY, JSON.stringify(log));
}

/**
 * Megnézi, van-e ma/holnap esedékes, még nyitott határidő, és ha az
 * értesítések engedélyezve vannak (böngésző ÉS felhasználói kapcsoló),
 * naponta legfeljebb egyszer tételenként emlékeztetőt küld rá.
 */
export function checkAndNotifyDueSoon(items: CalendarItem[]): void {
  if (!isNotificationSupported()) return;
  if (Notification.permission !== "granted") return;
  if (!areRemindersEnabled()) return;

  const today = todayDateKey();
  const tomorrow = tomorrowDateKey();

  let log = readNotifiedLog();
  if (log.dateKey !== today) {
    log = { dateKey: today, ids: [] };
  }

  const esedekesek = items.filter(
    (item) =>
      item.kind === "hatarido" &&
      (item.dateKey === today || item.dateKey === tomorrow) &&
      !log.ids.includes(item.id)
  );

  if (esedekesek.length === 0) return;

  for (const item of esedekesek) {
    const mikor = item.dateKey === today ? "Ma esedékes" : "Holnap esedékes";
    try {
      new Notification(`${mikor}: ${item.cim}`, {
        body: item.subtitle ?? "",
        tag: item.id,
      });
    } catch {
      // Néhány környezet (pl. háttérben futó tab bizonyos böngészőkben) nem
      // engedi a közvetlen Notification konstruktort — ilyenkor csendben
      // kihagyjuk, nincs mit tenni.
    }
    log.ids.push(item.id);
  }

  writeNotifiedLog(log);
}
