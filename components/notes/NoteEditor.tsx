"use client";

import { useEffect, useMemo, useRef, useState, type ElementType } from "react";
import {
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  X,
  Check,
  Tag as TagIcon,
  Eye,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { MarkdownContent } from "@/components/notes/MarkdownContent";
import { useAppStore } from "@/lib/store";
import { NOTE_CATEGORY_LABELS, type Note, type NoteCategory } from "@/types";
import { parseTags, todayIso } from "@/lib/utils";

// ============================================================================
// NoteEditor — jegyzetíró/-szerkesztő felület.
//
// Megjegyzés a szerkesztőről: ez a prototípus egy könnyűsúlyú, Markdown
// szintaxist beszúró textarea-t használ (nincs külső függőség). Éles
// verzióban ez 1:1 lecserélhető egy Tiptap vagy BlockNote szerkesztőre —
// a `tartalom` mező innentől kezdve ugyanúgy Markdown/HTML stringet vár,
// a store és a többi komponens nem tud a különbségről.
// ============================================================================

interface NoteEditorProps {
  subjectId: string;
  /** Ha meg van adva, szerkesztő módban nyílik meg, és automatikusan ment */
  note?: Note;
  onClose: () => void;
  onSaved?: (note: Note) => void;
}

const CATEGORY_OPTIONS: NoteCategory[] = ["eloadas", "gyakorlat", "labor", "egyeb"];

export function NoteEditor({ subjectId, note, onClose, onSaved }: NoteEditorProps) {
  const addNote = useAppStore((s) => s.addNote);
  const updateNote = useAppStore((s) => s.updateNote);

  const [cim, setCim] = useState(note?.cim ?? "");
  const [tipus, setTipus] = useState<NoteCategory>(note?.tipus ?? "eloadas");
  const [datum, setDatum] = useState(note?.datum ?? todayIso());
  const [tartalom, setTartalom] = useState(note?.tartalom ?? "");
  const [tagInput, setTagInput] = useState(note?.cimkek.map((t) => `#${t}`).join(" ") ?? "");
  const [savedNoteId, setSavedNoteId] = useState<string | undefined>(note?.id);
  const [lastSavedAt, setLastSavedAt] = useState<Date | undefined>(
    note ? new Date(note.updatedAt) : undefined
  );

  const [previewMode, setPreviewMode] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tags = useMemo(() => parseTags(tagInput), [tagInput]);

  const isDirty = useRef(false);
  useEffect(() => {
    isDirty.current = true;
  }, [cim, tipus, datum, tartalom, tagInput]);

  // ---- Automatikus mentés (debounce), csak már létező jegyzetnél ----------
  useEffect(() => {
    if (!savedNoteId) return; // új jegyzetnél explicit "Mentés" gomb kell
    if (!isDirty.current) return;
    const timeout = setTimeout(() => {
      updateNote(savedNoteId, { cim, tipus, datum, tartalom, cimkek: tags });
      setLastSavedAt(new Date());
      isDirty.current = false;
    }, 700);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cim, tipus, datum, tartalom, tags, savedNoteId]);

  function handleManualSave() {
    if (!cim.trim()) return;
    if (savedNoteId) {
      updateNote(savedNoteId, { cim, tipus, datum, tartalom, cimkek: tags });
      setLastSavedAt(new Date());
      toast.success("Jegyzet mentve");
    } else {
      const id = addNote({ subjectId, cim, tipus, datum, tartalom, cimkek: tags });
      setSavedNoteId(id);
      setLastSavedAt(new Date());
      toast.success("Jegyzet létrehozva");
      onSaved?.({
        id,
        subjectId,
        cim,
        tipus,
        datum,
        tartalom,
        cimkek: tags,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // ---- Markdown gyorsgombok: szintaxis beszúrása a kurzor pozíciójába ----
  function insertMarkdown(prefix: string, suffix = "", placeholder = "") {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = tartalom.slice(start, end) || placeholder;
    const next =
      tartalom.slice(0, start) + prefix + selected + suffix + tartalom.slice(end);
    setTartalom(next);
    requestAnimationFrame(() => {
      ta.focus();
      const cursor = start + prefix.length + selected.length + suffix.length;
      ta.setSelectionRange(cursor, cursor);
    });
  }

  // Csak adatok — az insertMarkdown() (ami a textareaRef.current-et olvassa)
  // szándékosan csak az onClick eseménykezelőben hívódik meg, sosem a
  // render-ág során, hogy a ref-olvasás mindig eseménykezelőn belül történjen.
  const toolbarButtons: {
    icon: ElementType;
    label: string;
    prefix: string;
    suffix: string;
    placeholder: string;
  }[] = [
    { icon: Bold, label: "Félkövér", prefix: "**", suffix: "**", placeholder: "félkövér szöveg" },
    { icon: Italic, label: "Dőlt", prefix: "*", suffix: "*", placeholder: "dőlt szöveg" },
    { icon: Heading2, label: "Alcím", prefix: "## ", suffix: "", placeholder: "Alcím" },
    { icon: List, label: "Felsorolás", prefix: "- ", suffix: "", placeholder: "Listaelem" },
    { icon: ListOrdered, label: "Számozott lista", prefix: "1. ", suffix: "", placeholder: "Listaelem" },
    { icon: CheckSquare, label: "Feladatlista", prefix: "- [ ] ", suffix: "", placeholder: "Teendő" },
    { icon: Quote, label: "Idézet", prefix: "> ", suffix: "", placeholder: "Idézet" },
    { icon: Code, label: "Kód", prefix: "`", suffix: "`", placeholder: "kód" },
  ];

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-4 p-6">
      {/* ---------------------------------------------------------------- */}
      {/* Fejléc: cím, kategória, dátum                                     */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex items-start justify-between gap-4">
        <Input
          value={cim}
          onChange={(e) => setCim(e.target.value)}
          placeholder="Jegyzet címe…"
          className="h-auto border-none px-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
        />
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Bezárás">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={tipus} onValueChange={(v) => setTipus(v as NoteCategory)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Típus" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {NOTE_CATEGORY_LABELS[opt]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={datum}
          onChange={(e) => setDatum(e.target.value)}
          className="w-40"
        />

        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md border px-3">
          <TagIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="#vizsgakérdés #definíció"
            className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Markdown eszköztár + előnézet-kapcsoló                              */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-1 rounded-lg border bg-muted/30 p-1.5">
        <div className="flex flex-wrap items-center gap-1">
          {toolbarButtons.map(({ icon: Icon, label, prefix, suffix, placeholder }) => (
            <Button
              key={label}
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={label}
              disabled={previewMode}
              onClick={() => insertMarkdown(prefix, suffix, placeholder)}
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
        <Button
          type="button"
          variant={previewMode ? "secondary" : "ghost"}
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setPreviewMode((p) => !p)}
        >
          {previewMode ? (
            <>
              <Pencil className="h-3.5 w-3.5" />
              Szerkesztés
            </>
          ) : (
            <>
              <Eye className="h-3.5 w-3.5" />
              Előnézet
            </>
          )}
        </Button>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Tartalom szerkesztő / előnézet                                     */}
      {/* ---------------------------------------------------------------- */}
      {previewMode ? (
        <div className="min-h-[320px] flex-1 rounded-md border px-4 py-3">
          {tartalom.trim() ? (
            <MarkdownContent content={tartalom} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Nincs még megjeleníthető tartalom.
            </p>
          )}
        </div>
      ) : (
        <Textarea
          ref={textareaRef}
          value={tartalom}
          onChange={(e) => setTartalom(e.target.value)}
          placeholder="Kezdd el írni a jegyzetet… (Markdown formázás támogatott)"
          className="min-h-[320px] flex-1 resize-none border-none px-0 text-[15px] leading-relaxed shadow-none focus-visible:ring-0"
        />
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Lábléc: mentés státusz + gombok                                    */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex items-center justify-between border-t pt-4">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {lastSavedAt ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              Mentve{" "}
              {lastSavedAt.toLocaleTimeString("hu-HU", {
                hour: "2-digit",
                minute: "2-digit",
              })}
              -kor
            </>
          ) : (
            "Még nincs mentve"
          )}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Mégse
          </Button>
          <Button onClick={handleManualSave} disabled={!cim.trim()}>
            Mentés
          </Button>
        </div>
      </div>
    </div>
  );
}

export default NoteEditor;
