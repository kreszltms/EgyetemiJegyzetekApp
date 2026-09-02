"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase";
import { useAppStore } from "@/lib/store";
import type { AppData } from "@/types";

// ============================================================================
// EGYETEMI JEGYZETEK — Felhős szinkronizáció (Firestore)
//
// Egyetlen Firestore dokumentumban (`userData/{uid}`) tároljuk a teljes
// AppData JSON-t — ugyanazt a formátumot, amit a "Biztonsági mentés" gomb is
// használ. Ez a legegyszerűbb megbízható megoldás egy személyes
// jegyzetalkalmazáshoz (nincs szükség több kollekcióra vagy bonyolult
// ütközés-feloldásra).
//
// Irány 1 — helyi → felhő: a Zustand store minden változását figyeljük,
// debounce-olva (900ms) felküldjük Firestore-ba.
// Irány 2 — felhő → helyi: `onSnapshot`-tal valós időben figyeljük a
// dokumentumot; ha más eszközön történt a változás, letöltjük és
// alkalmazzuk a helyi store-ra.
//
// Végtelen szinkron-kör elkerülése: mindig egy "kanonikus" (rendezett
// kulcsú) JSON string-et hasonlítunk össze — ha a bejövő felhő-adat
// megegyezik azzal, amit legutóbb mi magunk küldtünk/kaptunk, nem csinálunk
// semmit.
// ============================================================================

type SyncStatus = "idle" | "syncing" | "synced" | "error";

let statusState: SyncStatus = "idle";
const statusListeners = new Set<() => void>();

function setStatus(next: SyncStatus) {
  if (next === statusState) return;
  statusState = next;
  statusListeners.forEach((l) => l());
}

function subscribeStatus(listener: () => void) {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

function getStatusSnapshot(): SyncStatus {
  return statusState;
}

function getStatusServerSnapshot(): SyncStatus {
  return "idle";
}

/** A jelenlegi szinkronizációs állapot (sidebar jelzőhöz). */
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeStatus, getStatusSnapshot, getStatusServerSnapshot);
}

// ----------------------------------------------------------------------------
// Kanonikus (rendezett kulcsú) JSON — a Firestore SDK nem garantálja a
// mezők sorrendjének megőrzését, ezért a nyers JSON.stringify nem
// megbízható összehasonlításhoz.
// ----------------------------------------------------------------------------
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = canonicalize(obj[key]);
    }
    return sorted;
  }
  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function cloudDocToStableJson(data: Partial<AppData> | undefined): string {
  return stableStringify({
    semesters: data?.semesters ?? [],
    subjects: data?.subjects ?? [],
    notes: data?.notes ?? [],
    scheduleEvents: data?.scheduleEvents ?? [],
    celKredit: data?.celKredit ?? null,
    emailReminders: data?.emailReminders ?? null,
  });
}

function localStateToStableJson(): string {
  const { semesters, subjects, notes, scheduleEvents, celKredit, emailReminders } =
    useAppStore.getState();
  return stableStringify({
    semesters,
    subjects,
    notes,
    scheduleEvents,
    celKredit: celKredit ?? null,
    emailReminders: emailReminders ?? null,
  });
}

const DEBOUNCE_MS = 900;

/**
 * Bejelentkezett felhasználóhoz köti a Zustand store-t egy Firestore
 * dokumentumhoz, és mindkét irányban szinkronban tartja. Csak akkor fejt ki
 * hatást, ha `uid` nem null (kijelentkezett állapotban nem csinál semmit).
 */
export function useCloudSync(uid: string | null) {
  const hydratedOnceRef = useRef(false);
  const lastSyncedRef = useRef("");

  useEffect(() => {
    if (!uid) {
      setStatus("idle");
      return;
    }

    hydratedOnceRef.current = false;
    lastSyncedRef.current = "";
    let cancelled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let unsubscribeStore: (() => void) | null = null;

    const docRef = doc(getFirebaseDb(), "userData", uid);
    setStatus("syncing");

    function scheduleSave() {
      const current = localStateToStableJson();
      if (current === lastSyncedRef.current) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      setStatus("syncing");
      debounceTimer = setTimeout(async () => {
        const toPush = localStateToStableJson();
        lastSyncedRef.current = toPush;
        try {
          const parsed = JSON.parse(toPush) as Pick<
            AppData,
            "semesters" | "subjects" | "notes" | "scheduleEvents" | "celKredit" | "emailReminders"
          >;
          await setDoc(docRef, {
            ...parsed,
            version: useAppStore.getState().exportData().version,
            updatedAt: serverTimestamp(),
          });
          if (!cancelled) setStatus("synced");
        } catch {
          if (!cancelled) setStatus("error");
        }
      }, DEBOUNCE_MS);
    }

    const unsubscribeSnapshot: Unsubscribe = onSnapshot(
      docRef,
      async (snap) => {
        if (cancelled) return;

        if (!hydratedOnceRef.current) {
          hydratedOnceRef.current = true;
          if (snap.exists()) {
            // Van már felhős adat ehhez a fiókhoz -> ez a mérvadó, letöltjük.
            const json = cloudDocToStableJson(snap.data() as Partial<AppData>);
            lastSyncedRef.current = json;
            useAppStore.getState().importData(json);
          } else {
            // Első bejelentkezés ehhez a fiókhoz -> a jelenlegi helyi
            // adatokat (pl. korábbi, csak-helyi jegyzetek) feltöltjük
            // kezdő állapotként.
            const json = localStateToStableJson();
            lastSyncedRef.current = json;
            try {
              const parsed = JSON.parse(json) as Pick<
                AppData,
                "semesters" | "subjects" | "notes" | "scheduleEvents" | "celKredit" | "emailReminders"
              >;
              await setDoc(docRef, {
                ...parsed,
                version: useAppStore.getState().exportData().version,
                updatedAt: serverTimestamp(),
              });
            } catch {
              if (!cancelled) setStatus("error");
              return;
            }
          }
          if (!cancelled) setStatus("synced");
          // Csak MOST kezdjük figyelni a helyi változásokat, hogy a fenti
          // kezdeti importData()/setDoc() ne indítson felesleges kört.
          unsubscribeStore = useAppStore.subscribe(scheduleSave);
          return;
        }

        // Későbbi snapshot: vagy a saját write-unk visszaigazolása (ekkor a
        // JSON már megegyezik lastSyncedRef-fel, tehát nem csinálunk semmit),
        // vagy egy másik eszközön történt valódi változás.
        const json = cloudDocToStableJson(snap.data() as Partial<AppData> | undefined);
        if (json === lastSyncedRef.current) return;
        lastSyncedRef.current = json;
        useAppStore.getState().importData(json);
        setStatus("synced");
      },
      () => {
        if (!cancelled) setStatus("error");
      }
    );

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribeSnapshot();
      unsubscribeStore?.();
    };
  }, [uid]);
}
