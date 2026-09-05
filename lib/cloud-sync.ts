"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from "firebase/firestore";
import { toast } from "sonner";

import { getFirebaseDb } from "@/lib/firebase";
import { downloadConflictBackup, useAppStore } from "@/lib/store";
import type { AppData } from "@/types";

// ============================================================================
// UNINOTES — Felhős szinkronizáció (Firestore)
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
//
// Szinkron-ütközés kezelése: ha KÉT eszközön (pl. telefonon és laptopon) is
// dolgozol egyszerre, előfordulhat, hogy itt van még el nem küldött helyi
// módosítás (a 900ms-es debounce miatt), miközben egy MÁSIK eszköz gyorsabb
// volt, és már felküldte a sajátját. Enélkül a lenti isSyncConflict()
// ellenőrzés nélkül a később beérkező távoli verzió csendben felülírná a
// helyi, még el nem küldött változtatásaidat — ez néma adatvesztés lenne.
// Ezért ütközés esetén a helyi (vesztes) oldalt előbb letöltjük biztonsági
// mentésként (lib/store.ts downloadConflictBackup), és értesítjük a
// felhasználót, mielőtt alkalmaznánk a távoli verziót.
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

/**
 * Eldönti, hogy egy beérkező távoli (Firestore) állapot ÜTKÖZIK-e a még el
 * nem küldött helyi módosításokkal. Szándékosan tiszta függvény (nincs
 * mellékhatása, nem olvas Firestore-t/store-t), hogy a store és a Firestore
 * SDK bekötése nélkül, önmagában is egyszerűen tesztelhető legyen — lásd
 * tests/lib/cloud-sync.test.ts.
 *
 * Ütközés akkor áll fenn, ha (1) a helyi állapot eltér az utoljára
 * szinkronizált állapottól — vagyis van még el nem küldött helyi
 * módosítás —, ÉS (2) a most beérkező távoli állapot MÁS, mint ez a helyi
 * állapot. Ha a helyi állapot "tiszta" (nincs el nem küldött módosítás),
 * az egy normál, konfliktusmentes távoli frissítés, nem ütközés.
 */
export function isSyncConflict(params: {
  remoteJson: string;
  localJson: string;
  lastSyncedJson: string;
}): boolean {
  const { remoteJson, localJson, lastSyncedJson } = params;
  const hasUnsavedLocalChanges = localJson !== lastSyncedJson;
  const remoteDiffersFromLocal = remoteJson !== localJson;
  return hasUnsavedLocalChanges && remoteDiffersFromLocal;
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

        const localJson = localStateToStableJson();
        if (isSyncConflict({ remoteJson: json, localJson, lastSyncedJson: lastSyncedRef.current })) {
          // A távoli (másik eszközön mentett) állapot és az itt még el nem
          // küldött helyi módosítások eltérnek — mielőtt a távoli verziót
          // alkalmaznánk (és ezzel felülírnánk a helyit), a helyi oldalt
          // biztonsági mentésként letöltjük, hogy semmi ne vesszen el
          // nyomtalanul.
          downloadConflictBackup(useAppStore.getState().exportData());
          toast.warning("Szinkron-ütközés történt", {
            description:
              "Egy másik eszközön is módosítottad az adatokat, miközben itt is dolgoztál. A másik eszköz verziója lett érvényben — a saját, itt el nem küldött változtatásaid nem vesztek el, egy \"uninotes-utkozes-mentes-…\" fájlba letöltve megtalálod a Letöltések mappában, és a sidebar \"Adatok importálása\" gombjával tudod visszatölteni, ha szükséged van rá.",
            duration: 20000,
          });
        }

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
