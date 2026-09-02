"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Award,
  CalendarDays,
  CornerDownLeft,
  NotebookText,
  Search,
  Home,
} from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAppStore } from "@/lib/store";
import { SUBJECT_ICONS } from "@/lib/subject-icons";
import { NOTE_CATEGORY_LABELS } from "@/types";
import { cn, formatDateHu } from "@/lib/utils";
import type { Nezet } from "@/components/layout/AppShell";

// ============================================================================
// CommandPalette — gyors keresés / parancspaletta (Ctrl+K vagy Cmd+K).
// Egyetlen helyen keres nézetek, tárgyak és jegyzetek között, és a
// kiválasztás azonnal navigál — nem kell a sidebar-ban keresgélni.
// ============================================================================

interface ResultItem {
  key: string;
  group: "Nézetek" | "Tárgyak" | "Jegyzetek";
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

const MAX_SUBJECTS = 6;
const MAX_NOTES = 6;

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (nezet: Nezet) => void;
}

export function CommandPalette({ open, onOpenChange, onNavigate }: CommandPaletteProps) {
  const semesters = useAppStore((s) => s.semesters);
  const subjects = useAppStore((s) => s.subjects);
  const notes = useAppStore((s) => s.notes);
  const setActiveSemester = useAppStore((s) => s.setActiveSemester);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // A Radix Dialog.Content minden megnyitáskor újra felmountolódik (bezárva
  // eltűnik a fáról), így a `query`/`selectedIndex` fenti kezdőértékei
  // maguktól "visszaállnak" — nincs szükség külön reset-effektre. Csak a
  // fókuszt kell explicit beállítani, ami nem setState, hanem DOM-hatás.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  function goToSubject(subjectId: string, semesterId: string) {
    const semester = semesters.find((s) => s.id === semesterId);
    if (semester && !semester.aktiv) setActiveSemester(semesterId);
    onNavigate({ tipus: "targy", subjectId });
    onOpenChange(false);
  }

  function goToNote(subjectId: string, noteId: string) {
    const note = notes.find((n) => n.id === noteId);
    onNavigate({ tipus: "jegyzet-szerkesztes", subjectId, note });
    onOpenChange(false);
  }

  const results = useMemo<ResultItem[]>(() => {
    const q = query.trim().toLowerCase();
    const items: ResultItem[] = [];

    const views: { label: string; icon: React.ReactNode; nezet: Nezet; keywords: string }[] = [
      { label: "Kezdőlap", icon: <Home className="h-4 w-4" />, nezet: { tipus: "otthon" }, keywords: "kezdőlap otthon home" },
      { label: "Naptár", icon: <CalendarDays className="h-4 w-4" />, nezet: { tipus: "naptar" }, keywords: "naptár calendar órarend" },
      { label: "Kreditindex", icon: <Award className="h-4 w-4" />, nezet: { tipus: "kreditindex" }, keywords: "kreditindex jegyek átlag kredit" },
      { label: "Összes jegyzetem", icon: <NotebookText className="h-4 w-4" />, nezet: { tipus: "osszes-jegyzet" }, keywords: "összes jegyzet notes" },
    ];
    for (const v of views) {
      if (q && !v.label.toLowerCase().includes(q) && !v.keywords.includes(q)) continue;
      items.push({
        key: `nezet-${v.label}`,
        group: "Nézetek",
        label: v.label,
        icon: v.icon,
        onSelect: () => {
          onNavigate(v.nezet);
          onOpenChange(false);
        },
      });
    }

    const matchedSubjects = subjects.filter((sub) => !q || sub.nev.toLowerCase().includes(q) || sub.kod.toLowerCase().includes(q));
    for (const sub of matchedSubjects.slice(0, MAX_SUBJECTS)) {
      const SubjectIcon = SUBJECT_ICONS[sub.ikon] ?? SUBJECT_ICONS.BookOpen;
      items.push({
        key: `targy-${sub.id}`,
        group: "Tárgyak",
        label: sub.nev,
        sublabel: sub.kod,
        icon: (
          <div
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white"
            style={{ backgroundColor: sub.szin }}
          >
            <SubjectIcon className="h-3 w-3" />
          </div>
        ),
        onSelect: () => goToSubject(sub.id, sub.semesterId),
      });
    }

    const matchedNotes = q
      ? notes.filter(
          (n) => n.cim.toLowerCase().includes(q) || n.tartalom.toLowerCase().includes(q)
        )
      : [...notes].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    for (const note of matchedNotes.slice(0, MAX_NOTES)) {
      const subject = subjects.find((s) => s.id === note.subjectId);
      items.push({
        key: `jegyzet-${note.id}`,
        group: "Jegyzetek",
        label: note.cim,
        sublabel: [subject?.nev, NOTE_CATEGORY_LABELS[note.tipus], formatDateHu(note.datum)]
          .filter(Boolean)
          .join(" · "),
        icon: <NotebookText className="h-4 w-4" />,
        onSelect: () => goToNote(note.subjectId, note.id),
      });
    }

    return items;
  }, [query, subjects, notes, onNavigate, onOpenChange]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelectedIndex(0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      results[selectedIndex]?.onSelect();
    }
  }

  let lastGroup: string | null = null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[20%] max-w-lg translate-y-0 gap-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">Gyors keresés</DialogTitle>
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ugrás tárgyhoz, jegyzethez, nézethez…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Gyors keresés"
          />
          <kbd className="hidden shrink-0 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
            Esc
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nincs találat erre: „{query}”.
            </p>
          )}
          {results.map((item, i) => {
            const showGroupHeader = item.group !== lastGroup;
            lastGroup = item.group;
            return (
              <div key={item.key}>
                {showGroupHeader && (
                  <div className="px-2.5 pt-2.5 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {item.group}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => item.onSelect()}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                    i === selectedIndex ? "bg-muted text-foreground" : "text-foreground/90"
                  )}
                >
                  <span className="flex shrink-0 items-center justify-center text-muted-foreground">
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.label}</span>
                    {item.sublabel && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.sublabel}
                      </span>
                    )}
                  </span>
                  {i === selectedIndex && (
                    <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
