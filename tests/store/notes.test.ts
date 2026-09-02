import { beforeEach, describe, expect, it } from "vitest";

import { useAppStore } from "@/lib/store";
import { MAX_NOTE_VERSIONS } from "@/types";

// ============================================================================
// A store egyetlen (modulszintű) Zustand singleton, ezért minden teszt előtt
// visszaállítjuk alaphelyzetbe — így a tesztek nem szennyezik egymást.
// ============================================================================
beforeEach(() => {
  useAppStore.getState().resetAll();
});

function addTestSubjectAndNote() {
  const { addSemester, addSubject, addNote } = useAppStore.getState();
  const semesterId = addSemester({
    nev: "2026/2027 Ősz",
    kezdoDatum: undefined,
    zaroDatum: undefined,
  });
  const subjectId = addSubject({
    semesterId,
    nev: "Tárgy",
    kod: "T1",
    szin: "#000000",
    ikon: "BookOpen",
  });
  const noteId = addNote({
    subjectId,
    cim: "Eredeti cím",
    tipus: "eloadas",
    datum: "2026-09-01",
    tartalom: "Eredeti tartalom",
    cimkek: [],
  });
  return { semesterId, subjectId, noteId };
}

function getNote(id: string) {
  const note = useAppStore.getState().notes.find((n) => n.id === id);
  if (!note) throw new Error(`Nincs ilyen jegyzet: ${id}`);
  return note;
}

describe("useAppStore — jegyzet CRUD alapok", () => {
  it("addNote-tal létrehozott jegyzet megjelenik a lista elején", () => {
    const { noteId } = addTestSubjectAndNote();
    const notes = useAppStore.getState().notes;
    expect(notes[0].id).toBe(noteId);
    expect(notes[0].cim).toBe("Eredeti cím");
  });

  it("deleteNote eltávolítja a jegyzetet", () => {
    const { noteId } = addTestSubjectAndNote();
    useAppStore.getState().deleteNote(noteId);
    expect(useAppStore.getState().notes).toHaveLength(0);
  });
});

describe("useAppStore — jegyzet verziótörténet (hűtési idő)", () => {
  it("az első tartalmi módosítás pillanatképet vesz fel az EREDETI állapotról", () => {
    const { noteId } = addTestSubjectAndNote();
    useAppStore.getState().updateNote(noteId, { tartalom: "Módosított tartalom" });
    const note = getNote(noteId);
    expect(note.verziok).toHaveLength(1);
    expect(note.verziok![0].tartalom).toBe("Eredeti tartalom");
    expect(note.tartalom).toBe("Módosított tartalom");
  });

  it("a hűtési időn belüli újabb módosítás NEM vesz fel újabb pillanatképet", () => {
    const { noteId } = addTestSubjectAndNote();
    useAppStore.getState().updateNote(noteId, { tartalom: "v2" });
    useAppStore.getState().updateNote(noteId, { tartalom: "v3" });
    const note = getNote(noteId);
    expect(note.verziok).toHaveLength(1);
    expect(note.tartalom).toBe("v3");
  });

  it("csak cím/tartalom változás számít tartalmi módosításnak — pl. a cimkék módosítása nem hoz létre pillanatképet", () => {
    const { noteId } = addTestSubjectAndNote();
    useAppStore.getState().updateNote(noteId, { cimkek: ["uj"] });
    const note = getNote(noteId);
    expect(note.verziok ?? []).toHaveLength(0);
  });

  it("a hűtési idő lejárta után a következő tartalmi módosítás új pillanatképet vesz fel", () => {
    const { noteId } = addTestSubjectAndNote();
    useAppStore.getState().updateNote(noteId, { tartalom: "v2" });

    // Szimuláljuk, hogy az utolsó pillanatkép több mint 5 perce készült —
    // enélkül a teszt futása közben (valós időben) sosem telne le a hűtés.
    useAppStore.setState((s) => ({
      notes: s.notes.map((n) =>
        n.id === noteId
          ? {
              ...n,
              verziok: (n.verziok ?? []).map((v) => ({
                ...v,
                mentveKor: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
              })),
            }
          : n
      ),
    }));

    useAppStore.getState().updateNote(noteId, { tartalom: "v3" });
    const note = getNote(noteId);
    expect(note.verziok).toHaveLength(2);
    expect(note.verziok![1].tartalom).toBe("v2");
  });

  it("legfeljebb MAX_NOTE_VERSIONS pillanatképet tart meg, a legrégebbit eldobva", () => {
    const { noteId } = addTestSubjectAndNote();
    useAppStore.getState().updateNote(noteId, { tartalom: "v2" });
    const versionId = getNote(noteId).verziok![0].id;

    // A restoreNoteVersion a hűtési időtől függetlenül MINDIG felvesz egy
    // pillanatképet — ezzel egyszerűen, várakozás nélkül tesztelhető a
    // MAX_NOTE_VERSIONS-os korlát.
    for (let i = 0; i < MAX_NOTE_VERSIONS + 5; i++) {
      useAppStore.getState().restoreNoteVersion(noteId, versionId);
    }
    const note = getNote(noteId);
    expect(note.verziok).toHaveLength(MAX_NOTE_VERSIONS);
  });
});

describe("useAppStore — restoreNoteVersion", () => {
  it("visszaállítja a cím+tartalom mezőt egy korábbi verzióra, és pillanatképet vesz fel a visszaállítás előtti állapotról", () => {
    const { noteId } = addTestSubjectAndNote();
    useAppStore.getState().updateNote(noteId, { cim: "Új cím", tartalom: "Új tartalom" });
    const versionId = getNote(noteId).verziok![0].id; // az EREDETI állapot pillanatképe

    useAppStore.getState().restoreNoteVersion(noteId, versionId);
    const note = getNote(noteId);
    expect(note.cim).toBe("Eredeti cím");
    expect(note.tartalom).toBe("Eredeti tartalom");
    expect(note.verziok!.some((v) => v.tartalom === "Új tartalom")).toBe(true);
  });

  it("ismeretlen versionId-re nem csinál semmit", () => {
    const { noteId } = addTestSubjectAndNote();
    const before = getNote(noteId);
    useAppStore.getState().restoreNoteVersion(noteId, "nincs-ilyen");
    const after = getNote(noteId);
    expect(after.cim).toBe(before.cim);
    expect(after.tartalom).toBe(before.tartalom);
    expect(after.verziok ?? []).toHaveLength((before.verziok ?? []).length);
  });
});
