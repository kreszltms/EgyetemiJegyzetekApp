"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  AppData,
  DATA_SCHEMA_VERSION,
  DEFAULT_EMAIL_REMINDER_SETTINGS,
  DEFAULT_PONTOZAS,
  EmailReminderSettings,
  MAX_NOTE_VERSIONS,
  Note,
  NoteVersion,
  Requirement,
  ScheduleEvent,
  Semester,
  Subject,
} from "@/types";
import { generateId } from "@/lib/utils";
import type { ParsedScheduleEvent } from "@/lib/neptun-xlsx";

// ============================================================================
// UNINOTES — Zustand store
// Egyetlen forrás az igazságra: minden adat itt él, és a `persist`
// middleware automatikusan menti localStorage-ba minden változáskor.
// Nincs backend hívás, nincs SQL — 100% kliensoldali állapotkezelés.
// ============================================================================

// FONTOS: ez a kulcs SZÁNDÉKOSAN maradt a régi "egyetemi-jegyzetek-storage"
// néven az app UniNotes-ra átnevezése után is — ha átneveznénk, minden
// meglévő felhasználó localStorage-ban tárolt adata "eltűnne" (az app egy
// üres, új kulcs alól indulna), mivel a Zustand `persist` middleware ez
// alapján a kulcs alapján tölti be a mentett állapotot. A felhasználó felé
// megjelenő név (UniNotes) és a belső tárolási azonosító szándékosan
// független egymástól.
const STORAGE_KEY = "egyetemi-jegyzetek-storage";

/**
 * Egy jegyzet szerkesztése közben a NoteEditor 700ms-es debounce-szal
 * automatikusan ment (lásd components/notes/NoteEditor.tsx) — enélkül a
 * hűtési idő nélkül MINDEN automentés külön verziót hozna létre, és a
 * "verziótörténet" gyakorlatilag egy gépelés közbeni undo-stack lenne, nem
 * használható áttekintés a korábbi állapotokról. Ezért csak akkor veszünk
 * fel új pillanatképet, ha az utolsó óta legalább ennyi idő eltelt (vagy
 * még nincs egy sem).
 */
const NOTE_VERSION_COOLDOWN_MS = 5 * 60 * 1000;

/** Egy jegyzet aktuális (mentés ELŐTTI) cím+tartalom állapotát pillanatképként
 * hozzáfűzi a verziótörténethez, a MAX_NOTE_VERSIONS korlátra vágva. */
function appendNoteVersion(note: Note): NoteVersion[] {
  const existing = note.verziok ?? [];
  const snapshot: NoteVersion = {
    id: generateId(),
    mentveKor: new Date().toISOString(),
    cim: note.cim,
    tartalom: note.tartalom,
  };
  return [...existing, snapshot].slice(-MAX_NOTE_VERSIONS);
}

interface AppState {
  semesters: Semester[];
  subjects: Subject[];
  notes: Note[];
  scheduleEvents: ScheduleEvent[];
  /** Diplomához szükséges összes kredit — ld. types/index.ts AppData.celKredit. */
  celKredit?: number;
  /** Email-emlékeztető beállítás — ld. types/index.ts AppData.emailReminders. */
  emailReminders: EmailReminderSettings;

  // ---- Diplomához szükséges kredit ------------------------------------------
  setCelKredit: (value: number | undefined) => void;

  // ---- Email-emlékeztetők ----------------------------------------------------
  setEmailReminders: (settings: EmailReminderSettings) => void;

  // ---- Félévek ------------------------------------------------------------
  addSemester: (data: Pick<Semester, "nev" | "kezdoDatum" | "zaroDatum">) => string;
  updateSemester: (id: string, patch: Partial<Omit<Semester, "id">>) => void;
  deleteSemester: (id: string) => void;
  setActiveSemester: (id: string) => void;
  /**
   * Be/kikapcsolja egy félév "archivalt" jelzőjét. Ha az épp aktív
   * (kiválasztott) félévet archiváljuk, és van másik nem-archivált félév,
   * automatikusan azt állítjuk be aktívnak — így a Kezdőlap/oldalsáv nem
   * marad egy elrejtett félévre mutatva.
   */
  toggleSemesterArchived: (id: string) => void;

  // ---- Tárgyak --------------------------------------------------------------
  addSubject: (
    data: Pick<Subject, "semesterId" | "nev" | "kod" | "szin" | "ikon"> &
      Partial<Pick<Subject, "oktato" | "hianyzas" | "pontozas" | "kredit">>
  ) => string;
  updateSubject: (id: string, patch: Partial<Omit<Subject, "id">>) => void;
  deleteSubject: (id: string) => void;
  incrementHianyzas: (subjectId: string) => void;
  decrementHianyzas: (subjectId: string) => void;

  // ---- Követelmények --------------------------------------------------------
  addRequirement: (
    subjectId: string,
    data: Pick<
      Requirement,
      "nev" | "tipus" | "hatarido" | "megjegyzes" | "pontszamSzerzett" | "pontszamMax"
    >
  ) => void;
  updateRequirement: (
    subjectId: string,
    requirementId: string,
    patch: Partial<Omit<Requirement, "id">>
  ) => void;
  toggleRequirement: (subjectId: string, requirementId: string) => void;
  deleteRequirement: (subjectId: string, requirementId: string) => void;

  // ---- Jegyzetek ------------------------------------------------------------
  addNote: (
    data: Pick<Note, "subjectId" | "cim" | "tipus" | "datum" | "tartalom" | "cimkek"> &
      Partial<Pick<Note, "mellekletek">>
  ) => string;
  updateNote: (id: string, patch: Partial<Omit<Note, "id">>) => void;
  deleteNote: (id: string) => void;
  /**
   * Visszaállítja a jegyzet cím+tartalom mezőjét egy korábbi verzióra — a
   * visszaállítás ELŐTTI állapotot is elmenti egy új pillanatképként
   * (hűtési időtől függetlenül), hogy a visszaállítás se legyen
   * visszafordíthatatlan.
   */
  restoreNoteVersion: (noteId: string, versionId: string) => void;

  // ---- Órarend (Neptun import) -----------------------------------------------
  /** Lecseréli a teljes órarendet az újonnan importált eseményekre, és a
   * tárgy nevét egyeztetve automatikusan hozzárendeli a subjectId-t, ahol
   * lehet. Visszaadja az importált és az egyeztetett (Subject-hez kötött)
   * események számát. */
  importScheduleEvents: (
    events: ParsedScheduleEvent[]
  ) => { imported: number; matched: number };
  /**
   * Külső .ics fájlból importált eseményeket ad HOZZÁ a meglévő órarendhez
   * (nem cseréli le, mint a Neptun-import) — a duplikátumokat (azonos cím +
   * kezdés + befejezés) kihagyja, hogy ugyanazt a fájlt kétszer beimportálva
   * ne jelenjen meg minden esemény duplán.
   */
  importIcsEvents: (
    events: ParsedScheduleEvent[]
  ) => { imported: number; matched: number; skipped: number };
  clearSchedule: () => void;

  // ---- Szelektorok (számított lekérdezések) ----------------------------------
  getSubjectsBySemester: (semesterId: string) => Subject[];
  getNotesBySubject: (subjectId: string) => Note[];
  getAllTags: () => string[];
  getNotesByTag: (tag: string) => Note[];

  // ---- Import / Export --------------------------------------------------------
  exportData: () => AppData;
  importData: (json: string) => { success: boolean; error?: string };
  resetAll: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      semesters: [],
      subjects: [],
      notes: [],
      scheduleEvents: [],
      celKredit: undefined,
      emailReminders: DEFAULT_EMAIL_REMINDER_SETTINGS,

      setCelKredit: (value) => set({ celKredit: value }),

      setEmailReminders: (settings) => set({ emailReminders: settings }),

      // ---- Félévek ----------------------------------------------------------
      addSemester: (data) => {
        const id = generateId();
        const semester: Semester = {
          id,
          nev: data.nev,
          kezdoDatum: data.kezdoDatum,
          zaroDatum: data.zaroDatum,
          aktiv: get().semesters.length === 0,
          archivalt: false,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ semesters: [...s.semesters, semester] }));
        return id;
      },

      updateSemester: (id, patch) =>
        set((s) => ({
          semesters: s.semesters.map((sem) =>
            sem.id === id ? { ...sem, ...patch } : sem
          ),
        })),

      deleteSemester: (id) =>
        set((s) => {
          const subjectIds = s.subjects
            .filter((sub) => sub.semesterId === id)
            .map((sub) => sub.id);
          return {
            semesters: s.semesters.filter((sem) => sem.id !== id),
            subjects: s.subjects.filter((sub) => sub.semesterId !== id),
            notes: s.notes.filter((n) => !subjectIds.includes(n.subjectId)),
          };
        }),

      setActiveSemester: (id) =>
        set((s) => ({
          semesters: s.semesters.map((sem) => ({ ...sem, aktiv: sem.id === id })),
        })),

      toggleSemesterArchived: (id) =>
        set((s) => {
          const semesters = s.semesters.map((sem) =>
            sem.id === id ? { ...sem, archivalt: !sem.archivalt } : sem
          );
          const target = semesters.find((sem) => sem.id === id);
          if (target?.archivalt && target.aktiv) {
            const fallback = semesters.find(
              (sem) => sem.id !== id && !sem.archivalt
            );
            if (fallback) {
              return {
                semesters: semesters.map((sem) => ({
                  ...sem,
                  aktiv: sem.id === fallback.id,
                })),
              };
            }
          }
          return { semesters };
        }),

      // ---- Tárgyak ------------------------------------------------------------
      addSubject: (data) => {
        const id = generateId();
        const now = new Date().toISOString();
        const subject: Subject = {
          id,
          semesterId: data.semesterId,
          nev: data.nev,
          kod: data.kod,
          szin: data.szin,
          ikon: data.ikon,
          oktato: data.oktato ?? { nev: "", email: "", fogadoora: "" },
          hianyzas: data.hianyzas ?? { maxHianyzas: 3, jelenlegiHianyzas: 0 },
          pontozas: data.pontozas ?? DEFAULT_PONTOZAS,
          kredit: data.kredit,
          kovetelmenyek: [],
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ subjects: [...s.subjects, subject] }));
        return id;
      },

      updateSubject: (id, patch) =>
        set((s) => ({
          subjects: s.subjects.map((sub) =>
            sub.id === id
              ? { ...sub, ...patch, updatedAt: new Date().toISOString() }
              : sub
          ),
        })),

      deleteSubject: (id) =>
        set((s) => ({
          subjects: s.subjects.filter((sub) => sub.id !== id),
          notes: s.notes.filter((n) => n.subjectId !== id),
        })),

      incrementHianyzas: (subjectId) =>
        set((s) => ({
          subjects: s.subjects.map((sub) =>
            sub.id === subjectId
              ? {
                  ...sub,
                  hianyzas: {
                    ...sub.hianyzas,
                    jelenlegiHianyzas: sub.hianyzas.jelenlegiHianyzas + 1,
                  },
                  updatedAt: new Date().toISOString(),
                }
              : sub
          ),
        })),

      decrementHianyzas: (subjectId) =>
        set((s) => ({
          subjects: s.subjects.map((sub) =>
            sub.id === subjectId
              ? {
                  ...sub,
                  hianyzas: {
                    ...sub.hianyzas,
                    jelenlegiHianyzas: Math.max(0, sub.hianyzas.jelenlegiHianyzas - 1),
                  },
                  updatedAt: new Date().toISOString(),
                }
              : sub
          ),
        })),

      // ---- Követelmények ----------------------------------------------------
      addRequirement: (subjectId, data) =>
        set((s) => ({
          subjects: s.subjects.map((sub) =>
            sub.id === subjectId
              ? {
                  ...sub,
                  kovetelmenyek: [
                    ...sub.kovetelmenyek,
                    {
                      id: generateId(),
                      nev: data.nev,
                      tipus: data.tipus,
                      hatarido: data.hatarido,
                      megjegyzes: data.megjegyzes,
                      pontszamSzerzett: data.pontszamSzerzett,
                      pontszamMax: data.pontszamMax,
                      teljesitve: false,
                    },
                  ],
                  updatedAt: new Date().toISOString(),
                }
              : sub
          ),
        })),

      updateRequirement: (subjectId, requirementId, patch) =>
        set((s) => ({
          subjects: s.subjects.map((sub) =>
            sub.id === subjectId
              ? {
                  ...sub,
                  kovetelmenyek: sub.kovetelmenyek.map((req) =>
                    req.id === requirementId ? { ...req, ...patch } : req
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : sub
          ),
        })),

      toggleRequirement: (subjectId, requirementId) =>
        set((s) => ({
          subjects: s.subjects.map((sub) =>
            sub.id === subjectId
              ? {
                  ...sub,
                  kovetelmenyek: sub.kovetelmenyek.map((req) =>
                    req.id === requirementId
                      ? { ...req, teljesitve: !req.teljesitve }
                      : req
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : sub
          ),
        })),

      deleteRequirement: (subjectId, requirementId) =>
        set((s) => ({
          subjects: s.subjects.map((sub) =>
            sub.id === subjectId
              ? {
                  ...sub,
                  kovetelmenyek: sub.kovetelmenyek.filter(
                    (req) => req.id !== requirementId
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : sub
          ),
        })),

      // ---- Jegyzetek ----------------------------------------------------------
      addNote: (data) => {
        const id = generateId();
        const now = new Date().toISOString();
        const note: Note = {
          id,
          subjectId: data.subjectId,
          cim: data.cim,
          tipus: data.tipus,
          datum: data.datum,
          tartalom: data.tartalom,
          cimkek: data.cimkek,
          mellekletek: data.mellekletek ?? [],
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ notes: [note, ...s.notes] }));
        return id;
      },

      updateNote: (id, patch) =>
        set((s) => ({
          notes: s.notes.map((n) => {
            if (n.id !== id) return n;

            const contentChanged =
              (patch.cim !== undefined && patch.cim !== n.cim) ||
              (patch.tartalom !== undefined && patch.tartalom !== n.tartalom);

            let verziok = n.verziok;
            if (contentChanged) {
              const existing = n.verziok ?? [];
              const last = existing[existing.length - 1];
              const lastAgeMs = last
                ? Date.now() - new Date(last.mentveKor).getTime()
                : Infinity;
              if (lastAgeMs >= NOTE_VERSION_COOLDOWN_MS) {
                verziok = appendNoteVersion(n);
              }
            }

            return { ...n, ...patch, verziok, updatedAt: new Date().toISOString() };
          }),
        })),

      deleteNote: (id) =>
        set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      restoreNoteVersion: (noteId, versionId) =>
        set((s) => ({
          notes: s.notes.map((n) => {
            if (n.id !== noteId) return n;
            const version = (n.verziok ?? []).find((v) => v.id === versionId);
            if (!version) return n;
            return {
              ...n,
              cim: version.cim,
              tartalom: version.tartalom,
              // A visszaállítás előtti állapotot MINDIG elmentjük, a
              // hűtési időtől függetlenül — ez egy szándékos, ritka
              // felhasználói művelet, nem automentés-zaj.
              verziok: appendNoteVersion(n),
              updatedAt: new Date().toISOString(),
            };
          }),
        })),

      // ---- Órarend (Neptun import) -----------------------------------------------
      importScheduleEvents: (events) => {
        const subjects = get().subjects;
        let matched = 0;
        const scheduleEvents: ScheduleEvent[] = events.map((ev) => {
          const subject = subjects.find(
            (sub) => sub.nev.trim().toLowerCase() === ev.cim.trim().toLowerCase()
          );
          if (subject) matched += 1;
          return { ...ev, id: generateId(), subjectId: subject?.id };
        });
        set({ scheduleEvents });
        return { imported: scheduleEvents.length, matched };
      },

      importIcsEvents: (events) => {
        const subjects = get().subjects;
        const existing = get().scheduleEvents;
        const existingKeys = new Set(
          existing.map((ev) => `${ev.cim.toLowerCase()}|${ev.kezdes}|${ev.befejezes}`)
        );
        let matched = 0;
        let skipped = 0;
        const toAdd: ScheduleEvent[] = [];
        for (const ev of events) {
          const key = `${ev.cim.toLowerCase()}|${ev.kezdes}|${ev.befejezes}`;
          if (existingKeys.has(key)) {
            skipped += 1;
            continue;
          }
          existingKeys.add(key);
          const subject = subjects.find(
            (sub) => sub.nev.trim().toLowerCase() === ev.cim.trim().toLowerCase()
          );
          if (subject) matched += 1;
          toAdd.push({ ...ev, id: generateId(), subjectId: subject?.id });
        }
        set({ scheduleEvents: [...existing, ...toAdd] });
        return { imported: toAdd.length, matched, skipped };
      },

      clearSchedule: () => set({ scheduleEvents: [] }),

      // ---- Szelektorok ----------------------------------------------------------
      getSubjectsBySemester: (semesterId) =>
        get().subjects.filter((sub) => sub.semesterId === semesterId),

      getNotesBySubject: (subjectId) =>
        get()
          .notes.filter((n) => n.subjectId === subjectId)
          .sort((a, b) => (a.datum < b.datum ? 1 : -1)),

      getAllTags: () => {
        const all = get().notes.flatMap((n) => n.cimkek);
        return Array.from(new Set(all)).sort();
      },

      getNotesByTag: (tag) =>
        get().notes.filter((n) => n.cimkek.includes(tag.toLowerCase())),

      // ---- Import / Export ----------------------------------------------------
      exportData: () => {
        const { semesters, subjects, notes, scheduleEvents, celKredit, emailReminders } = get();
        return {
          semesters,
          subjects,
          notes,
          scheduleEvents,
          celKredit,
          emailReminders,
          version: DATA_SCHEMA_VERSION,
          exportedAt: new Date().toISOString(),
        };
      },

      importData: (json) => {
        try {
          const parsed = JSON.parse(json) as Partial<AppData>;
          if (
            !parsed ||
            !Array.isArray(parsed.semesters) ||
            !Array.isArray(parsed.subjects) ||
            !Array.isArray(parsed.notes)
          ) {
            return {
              success: false,
              error:
                "Érvénytelen fájlformátum. A JSON-nak semesters, subjects és notes tömböket kell tartalmaznia.",
            };
          }
          set({
            semesters: parsed.semesters,
            subjects: parsed.subjects,
            notes: parsed.notes,
            // Régebbi exportokban/felhő-dokumentumokban még nem szerepelt —
            // ilyenkor üres tömbként kezeljük.
            scheduleEvents: Array.isArray(parsed.scheduleEvents)
              ? parsed.scheduleEvents
              : [],
            celKredit:
              typeof parsed.celKredit === "number" ? parsed.celKredit : undefined,
            // Régebbi exportokban/felhő-dokumentumokban még nem szerepelt —
            // ilyenkor a "kikapcsolva" alapértelmezést vesszük fel.
            emailReminders:
              parsed.emailReminders && typeof parsed.emailReminders.enabled === "boolean"
                ? {
                    enabled: parsed.emailReminders.enabled,
                    napokElotte:
                      typeof parsed.emailReminders.napokElotte === "number"
                        ? parsed.emailReminders.napokElotte
                        : DEFAULT_EMAIL_REMINDER_SETTINGS.napokElotte,
                  }
                : DEFAULT_EMAIL_REMINDER_SETTINGS,
          });
          return { success: true };
        } catch {
          return {
            success: false,
            error: "A fájl nem érvényes JSON. Ellenőrizd a kiválasztott fájlt.",
          };
        }
      },

      resetAll: () =>
        set({
          semesters: [],
          subjects: [],
          notes: [],
          scheduleEvents: [],
          celKredit: undefined,
          emailReminders: DEFAULT_EMAIL_REMINDER_SETTINGS,
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);

// ============================================================================
// Segédfüggvények az export/import UI-hoz (fájl letöltés / feltöltés)
// Ezeket a komponensek hívják, a böngésző File API-ját használva.
// ============================================================================

/** Letölti az aktuális adatokat "uninotes-mentes-<datum>.json" néven */
export function downloadJsonBackup() {
  const data = useAppStore.getState().exportData();
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const datePart = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `uninotes-mentes-${datePart}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Beolvas egy File objektumot (pl. <input type="file">-ból) és importálja */
export function importJsonBackup(
  file: File
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      resolve(useAppStore.getState().importData(text));
    };
    reader.onerror = () =>
      resolve({ success: false, error: "Nem sikerült beolvasni a fájlt." });
    reader.readAsText(file);
  });
}
