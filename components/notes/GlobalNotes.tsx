"use client";

import { useMemo, useState } from "react";
import { Search, Tag as TagIcon, X } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MarkdownContent } from "@/components/notes/MarkdownContent";
import { useAppStore } from "@/lib/store";
import { NOTE_CATEGORY_LABELS, type Note } from "@/types";
import { cn, formatDateHu } from "@/lib/utils";

export function GlobalNotes({ onOpenNote }: { onOpenNote: (note: Note) => void }) {
  const notes = useAppStore((s) => s.notes);
  const subjects = useAppStore((s) => s.subjects);
  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const allTags = useMemo(
    () => Array.from(new Set(notes.flatMap((n) => n.cimkek))).sort(),
    [notes]
  );

  const filtered = useMemo(() => {
    return notes
      .filter((n) => {
        const matchesSearch =
          search.trim() === "" ||
          n.cim.toLowerCase().includes(search.toLowerCase()) ||
          n.tartalom.toLowerCase().includes(search.toLowerCase());
        const matchesTag = !activeTag || n.cimkek.includes(activeTag);
        return matchesSearch && matchesTag;
      })
      .sort((a, b) => (a.datum < b.datum ? 1 : -1));
  }, [notes, search, activeTag]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Összes jegyzetem</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Keress vagy szűrj címke alapján az összes féléved és tárgyad jegyzetei között.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Keresés az összes jegyzet között…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <TagIcon className="h-3.5 w-3.5 text-muted-foreground" />
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                activeTag === tag
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              #{tag}
            </button>
          ))}
          {activeTag && (
            <button
              onClick={() => setActiveTag(null)}
              className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Szűrő törlése
            </button>
          )}
        </div>
      )}

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nincs a keresésnek megfelelő jegyzet.
          </div>
        )}
        {filtered.map((note) => {
          const subject = subjectById.get(note.subjectId);
          return (
            <Card
              key={note.id}
              className="cursor-pointer border shadow-none transition-colors hover:bg-muted/40"
              onClick={() => onOpenNote(note)}
            >
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium">{note.cim}</h3>
                  <Badge variant="outline" className="text-[10px]">
                    {NOTE_CATEGORY_LABELS[note.tipus]}
                  </Badge>
                  {subject && (
                    <span
                      className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white"
                      style={{ backgroundColor: subject.szin }}
                    >
                      {subject.nev}
                    </span>
                  )}
                </div>
                <MarkdownContent
                  content={note.tartalom}
                  inline
                  className="mt-1 line-clamp-2 text-sm text-muted-foreground"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatDateHu(note.datum)}
                  </span>
                  {note.cimkek.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
