"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { buildCalendarItems } from "@/lib/calendar-helpers";
import {
  areRemindersEnabled,
  checkAndNotifyDueSoon,
  getNotificationPermission,
  isNotificationSupported,
  requestNotificationPermission,
  setRemindersEnabled,
} from "@/lib/reminders";
import { useAppStore } from "@/lib/store";

const emptySubscribe = () => () => {};

/** SSR-biztos "kliensen vagyunk-e már" jelző, ld. theme-toggle.tsx mintáját. */
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

/**
 * Harang gomb a sidebar alján: be/kikapcsolja a böngésző-emlékeztetőket a
 * ma/holnap esedékes határidőkre, és — amíg be van kapcsolva — az app minden
 * betöltésekor/fókuszba kerülésekor lefuttatja az ellenőrzést.
 */
export function ReminderBell() {
  const scheduleEvents = useAppStore((s) => s.scheduleEvents);
  const subjects = useAppStore((s) => s.subjects);
  const mounted = useMounted();
  // Lazy kezdőérték (nem effektusban állítva, ld. react-hooks/set-state-in-effect)
  // — biztonságos, mert `areRemindersEnabled()` szerveren mindig `false`-t ad
  // vissza, és a komponens úgyis `null`-t renderel, amíg `mounted` nem igaz.
  const [enabled, setEnabled] = useState(() => areRemindersEnabled());

  useEffect(() => {
    if (!enabled) return;
    function run() {
      checkAndNotifyDueSoon(buildCalendarItems(scheduleEvents, subjects));
    }
    run();
    function handleVisibility() {
      if (document.visibilityState === "visible") run();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [enabled, scheduleEvents, subjects]);

  if (!mounted || !isNotificationSupported()) return null;

  async function handleClick() {
    if (enabled) {
      setRemindersEnabled(false);
      setEnabled(false);
      toast.success("Emlékeztetők kikapcsolva.");
      return;
    }

    const permission =
      getNotificationPermission() === "granted"
        ? "granted"
        : await requestNotificationPermission();

    if (permission !== "granted") {
      toast.error(
        "Az emlékeztetőkhöz engedélyezned kell az értesítéseket a böngésződben."
      );
      return;
    }

    setRemindersEnabled(true);
    setEnabled(true);
    toast.success(
      "Emlékeztetők bekapcsolva — a ma/holnap esedékes határidőkről itt kapsz jelzést, amíg az app nyitva van."
    );
    checkAndNotifyDueSoon(buildCalendarItems(scheduleEvents, subjects));
  }

  const permissionDenied = getNotificationPermission() === "denied";

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={handleClick}
      disabled={permissionDenied && !enabled}
      aria-label={enabled ? "Emlékeztetők kikapcsolása" : "Emlékeztetők bekapcsolása"}
      title={
        permissionDenied && !enabled
          ? "Az értesítések le vannak tiltva a böngésződben"
          : enabled
            ? "Emlékeztetők kikapcsolása"
            : "Emlékeztetők bekapcsolása a közelgő határidőkre"
      }
    >
      {enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
    </Button>
  );
}
