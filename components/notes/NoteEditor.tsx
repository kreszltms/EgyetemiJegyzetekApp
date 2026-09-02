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
  Columns2,
  CalendarDays,
  ImagePlus,
  Loader2,
  History,
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
import { NoteVersionHistoryDialog } from "@/components/notes/NoteVersionHistoryDialog";
import { useAppStore } from "@/lib/store";
import {
  NOTE_CATEGORY_LABELS,
  type Note,
  type NoteAttachment,
  type NoteCategory,
  type NoteVersion,
} from "@/types";
import { SUBJECT_ICONS } from "@/lib/subject-icons";
import {
  MAX_ATTACHMENTS_PER_NOTE,
  formatAttachmentSize,
  processImageFile,
} from "@/lib/note-attachments";
import { NOTE_TEMPLATES } from "@/lib/note-templates";
import { cn, parseTags, todayIso } from "@/lib/utils";

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

type ViewMode = "szerkesztes" | "hasitott" | "elonezet";

const CATEGORY_OPTIONS: NoteCategory[] = ["eloadas", "gyakorlat", "labor", "egyeb"];

// Stabil, egyszer létrehozott üres tömb-referencia a noteVersions
// szelektorhoz — enélkül minden render alkalmával egy ÚJ `[]` literál jönne
// létre a "?? []" fallbacknál, ami megsérti a useSyncExternalStore
// (Zustand) referencia-egyenlőségi feltételezését, és végtelen render-körbe
// futna (lásd ugyanezt a mintát lib/auth.ts és lib/cloud-sync.ts
// kommentjeiben).
const EMPTY_VERSIONS: NoteVersion[] = [];

export function NoteEditor({ subjectId, note, onClose, onSaved }: NoteEditorProps) {
  const addNote = useAppStore((s) => s.addNote);
  const updateNote = useAppStore((s) => s.updateNote);
  const restoreNoteVersion = useAppStore((s) => s.restoreNoteVersion);
  const subject = useAppStore((s) => s.subjects.find((sub) => sub.id === subjectId));
  const SubjectIcon = SUBJECT_ICONS[subject?.ikon ?? ""] ?? SUBJECT_ICONS.BookOpen;

  const [cim, setCim] = useState(note?.cim ?? "");
  const [tipus, setTipus] = useState<NoteCategory>(note?.tipus ?? "eloadas");
  const [datum, setDatum] = useState(note?.datum ?? todayIso());
  const [tartalom, setTartalom] = useState(note?.tartalom ?? "");
  const [tagInput, setTagInput] = useState(note?.cimkek.map((t) => `#${t}`).join(" ") ?? "");
  const [attachments, setAttachments] = useState<NoteAttachment[]>(note?.mellekletek ?? []);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [savedNoteId, setSavedNoteId] = useState<string | undefined>(note?.id);
  const [lastSavedAt, setLastSavedAt] = useState<Date | undefined>(
    note ? new Date(note.updatedAt) : undefined
  );

  const [viewMode, setViewMode] = useState<ViewMode>("szerkesztes");
  const [historyOpen, setHistoryOpen] = useState(false);

  // Élőben olvassuk a store-ból, hogy az automentés által közben felvett
  // verziók (lásd lib/store.ts updateNote) is megjelenjenek a Történet
  // dialógusban, ne csak a komponens megnyitásakori pillanatkép.
  const noteVersions = useAppStore(
    (s) => s.notes.find((n) => n.id === savedNoteId)?.verziok ?? EMPTY_VERSIONS
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const tags = useMemo(() => parseTags(tagInput), [tagInput]);

  const wordCount = useMemo(() => {
    const trimmed = tartalom.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [tartalom]);

  const isDirty = useRef(false);
  useEffect(() => {
    isDirty.current = true;
  }, [cim, tipus, datum, tartalom, tagInput, attachments]);

  // ---- Automatikus mentés (debounce), csak már létező jegyzetnél ----------
  useEffect(() => {
    if (!savedNoteId) return; // új jegyzetnél explicit "Mentés" gomb kell
    if (!isDirty.current) return;
    const timeout = setTimeout(() => {
      updateNote(savedNoteId, { cim, tipus, datum, tartalom, cimkek: tags, mellekletek: attachments });
      setLastSavedAt(new Date());
      isDirty.current = false;
    }, 700);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cim, tipus, datum, tartalom, tags, attachments, savedNoteId]);

  function handleManualSave() {
    if (!cim.trim()) return;
    if (savedNoteId) {
      updateNote(savedNoteId, { cim, tipus, datum, tartalom, cimkek: tags, mellekletek: attachments });
      setLastSavedAt(new Date());
      toast.success("Jegyzet mentve");
    } else {
      const id = addNote({ subjectId, cim, tipus, datum, tartalom, cimkek: tags, mellekletek: attachments });
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
        mellekletek: attachments,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // ---- Verziótörténet: korábbi állapot visszaállítása ---------------------
  function handleRestoreVersion(version: NoteVersion) {
    if (!savedNoteId) return;
    restoreNoteVersion(savedNoteId, version.id);
    // A store-beli visszaállítást a szerkesztő saját (kontrollált input)
    // állapotában is át kell vezetni, különben a mezők a store frissítése
    // után is a régi tartalmat mutatnák.
    setCim(version.cim);
    setTartalom(version.tartalom);
    isDirty.current = false;
    setLastSavedAt(new Date());
    setHistoryOpen(false);
    toast.success(
      "Korábbi verzió visszaállítva — az előző tartalom is elmentve az előzmények közé."
    );
  }

  // ---- Képmelléklet feltöltése -------------------------------------------
  async function handleAttachmentFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = MAX_ATTACHMENTS_PER_NOTE - attachments.length;
    if (remaining <= 0) {
      toast.error(`Legfeljebb ${MAX_ATTACHMENTS_PER_NOTE} kép csatolható egy jegyzethez.`);
      return;
    }
    const selected = Array.from(files).slice(0, remaining);
    setUploadingAttachment(true);
    for (const file of selected) {
      const result = await processImageFile(file);
      if (result.success) {
        setAttachments((prev) => [...prev, result.attachment]);
      } else {
        toast.error(result.error);
      }
    }
    setUploadingAttachment(false);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
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

  // Egy címke eltávolítása a nyers tagInput szövegből (a "#cimke" tokent
  // szedi ki, kis-nagybetűtől függetlenül), majd a felesleges szóközöket
  // összevonja.
  function removeTag(tag: string) {
    setTagInput((prev) =>
      prev
        .replace(new RegExp(`#${tag}\\b`, "i"), "")
        .replace(/\s+/g, " ")
        .trim()
    );
  }

  // Csak adatok — az insertMarkdown() (ami a textareaRef.current-et olvassa)
  // szándékosan csak az onClick eseménykezelőben hívódik meg, sosem a
  // render-ág során, hogy a ref-olvasás mindig eseménykezelőn belül történjen.
  const toolbarGroups: {
    icon: ElementType;
    label: string;
    prefix: string;
    suffix: string;
    placeholder: string;
  }[][] = [
    [
      { icon: Bold, label: "Félkövér", prefix: "**", suffix: "**", placeholder: "félkövér szöveg" },
      { icon: Italic, label: "Dőlt", prefix: "*", suffix: "*", placeholder: "dőlt szöveg" },
      { icon: Heading2, label: "Alcím", prefix: "## ", suffix: "", placeholder: "Alcím" },
    ],
    [
      { icon: List, label: "Felsorolás", prefix: "- ", suffix: "", placeholder: "Listaelem" },
      { icon: ListOrdered, label: "Számozott lista", prefix: "1. ", suffix: "", placeholder: "Listaelem" },
      { icon: CheckSquare, label: "Feladatlista", prefix: "- [ ] ", suffix: "", placeholder: "Teendő" },
    ],
    [
      { icon: Quote, label: "Idézet", prefix: "> ", suffix: "", placeholder: "Idézet" },
      { icon: Code, label: "Kód", prefix: "`", suffix: "`", placeholder: "kód" },
    ],
  ];

  const editingDisabled = viewMode === "elonezet";
  const showEditor = viewMode === "szerkesztes" || viewMode === "hasitott";
  const showPreview = viewMode === "elonezet" || viewMode === "hasitott";

  return (
    <div className="mx-auto flex min-h-full max-w-4xl flex-col gap-3 p-6">
      {/* ---------------------------------------------------------------- */}
      {/* Kontextus-sáv: melyik tárgyhoz tartozik a jegyzet                  */}
      {/* ---------------------------------------------------------------- */}
      {subject && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white"
            style={{ backgroundColor: subject.szin }}
          >
            <SubjectIcon className="h-3 w-3" />
          </div>
          <span className="truncate">{subject.nev}</span>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm sm:p-6">
        {/* -------------------------------------------------------------- */}
        {/* Fejléc: cím, kategória, dátum                                   */}
        {/* -------------------------------------------------------------- */}
        <div className="flex items-start justify-between gap-4">
          <Input
            value={cim}
            onChange={(e) => setCim(e.target.value)}
            placeholder="Jegyzet címe…"
            aria-label="Jegyzet címe"
            className="h-auto border-none px-0 text-2xl font-semibold shadow-none"
          />
          {savedNoteId && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setHistoryOpen(true)}
              aria-label="Verziótörténet megtekintése"
              title="Verziótörténet"
            >
              <History className="h-4 w-4" />
            </Button>
          )}
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

          <div className="flex h-9 w-40 items-center gap-1.5 rounded-md border px-3 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              aria-label="Jegyzet dátuma"
              className="h-full flex-1 bg-transparent text-sm outline-none [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>

          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md border px-3 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
            <TagIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="#vizsgakérdés #definíció"
              aria-label="Címkék (# jellel elválasztva)"
              className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="group flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-2.5 text-xs text-muted-foreground"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  aria-label={`#${tag} címke eltávolítása`}
                  className="rounded-full p-0.5 text-muted-foreground/70 hover:bg-background hover:text-foreground"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* -------------------------------------------------------------- */}
        {/* Markdown eszköztár + nézetválasztó                                */}
        {/* -------------------------------------------------------------- */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-1.5">
          <div className="flex flex-wrap items-center gap-1">
            {toolbarGroups.map((group, i) => (
              <div key={i} className="flex items-center gap-1">
                {i > 0 && <div className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />}
                {group.map(({ icon: Icon, label, prefix, suffix, placeholder }) => (
                  <Button
                    key={label}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title={label}
                    aria-label={label}
                    disabled={editingDisabled}
                    onClick={() => insertMarkdown(prefix, suffix, placeholder)}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                ))}
              </div>
            ))}
            <div className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Kép csatolása"
              aria-label="Kép csatolása"
              disabled={editingDisabled || uploadingAttachment || attachments.length >= MAX_ATTACHMENTS_PER_NOTE}
              onClick={() => attachmentInputRef.current?.click()}
            >
              {uploadingAttachment ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
            </Button>
            <input
              ref={attachmentInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                handleAttachmentFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {/* Háromállású nézetválasztó: szerkesztés / hasított / előnézet */}
          <div className="flex items-center gap-0.5 rounded-md bg-background p-0.5">
            <Button
              type="button"
              variant={viewMode === "szerkesztes" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => setViewMode("szerkesztes")}
              title="Csak szerkesztés"
              aria-label="Csak szerkesztés"
              aria-pressed={viewMode === "szerkesztes"}
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Szerkesztés</span>
            </Button>
            <Button
              type="button"
              variant={viewMode === "hasitott" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => setViewMode("hasitott")}
              title="Hasított nézet (szerkesztés + élő előnézet)"
              aria-label="Hasított nézet"
              aria-pressed={viewMode === "hasitott"}
            >
              <Columns2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Hasított</span>
            </Button>
            <Button
              type="button"
              variant={viewMode === "elonezet" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => setViewMode("elonezet")}
              title="Csak előnézet"
              aria-label="Csak előnézet"
              aria-pressed={viewMode === "elonezet"}
            >
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Előnézet</span>
            </Button>
          </div>
        </div>

        {/* Sablon-választó — csak amíg a jegyzet üres, utána eltűnik */}
        {tartalom.trim() === "" && viewMode !== "elonezet" && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>Kezdés sablonnal:</span>
            {NOTE_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setTartalom(tpl.content)}
                className="rounded-full border px-2.5 py-1 transition-colors hover:bg-muted hover:text-foreground"
              >
                {tpl.label}
              </button>
            ))}
          </div>
        )}

        {/* -------------------------------------------------------------- */}
        {/* Tartalom szerkesztő / élő előnézet                                */}
        {/* -------------------------------------------------------------- */}
        <div
          className={cn(
            "flex min-h-0 flex-1 gap-4",
            viewMode === "hasitott" ? "flex-col md:flex-row" : "flex-col"
          )}
        >
          {showEditor && (
            <div
              className={cn(
                "flex min-h-[240px] flex-1 flex-col",
                viewMode === "hasitott" && "md:w-1/2"
              )}
            >
              {viewMode === "hasitott" && (
                <span className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Szerkesztés
                </span>
              )}
              <Textarea
                ref={textareaRef}
                value={tartalom}
                onChange={(e) => setTartalom(e.target.value)}
                placeholder="Kezdd el írni a jegyzetet… (Markdown formázás támogatott)"
                aria-label="Jegyzet tartalma (Markdown)"
                className={cn(
                  "flex-1 resize-none text-[15px] leading-relaxed shadow-none",
                  viewMode === "hasitott"
                    ? "rounded-md border px-3 py-2.5"
                    : "border-none px-0"
                )}
              />
            </div>
          )}

          {showPreview && (
            <div
              className={cn(
                "flex min-h-[240px] flex-1 flex-col",
                viewMode === "hasitott" && "border-t pt-4 md:w-1/2 md:border-t-0 md:border-l md:pt-0 md:pl-4"
              )}
            >
              {viewMode === "hasitott" && (
                <span className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Élő előnézet
                </span>
              )}
              <div className="flex-1 overflow-y-auto rounded-md border px-4 py-3">
                {tartalom.trim() ? (
                  <MarkdownContent content={tartalom} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nincs még megjeleníthető tartalom.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* -------------------------------------------------------------- */}
        {/* Csatolt képek                                                     */}
        {/* -------------------------------------------------------------- */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((att) => (
              <a
                key={att.id}
                href={att.dataUrl}
                target="_blank"
                rel="noreferrer"
                className="group relative block h-20 w-20 shrink-0 overflow-hidden rounded-md border"
                title={`${att.nev} (${formatAttachmentSize(att.meret)}) — megnyitás teljes méretben`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL, nem Next Image-kompatibilis forrás */}
                <img
                  src={att.dataUrl}
                  alt={att.nev}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeAttachment(att.id);
                  }}
                  aria-label={`${att.nev} melléklet eltávolítása`}
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </a>
            ))}
          </div>
        )}

        {/* -------------------------------------------------------------- */}
        {/* Lábléc: mentés státusz + gombok                                   */}
        {/* -------------------------------------------------------------- */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
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
            {wordCount > 0 && (
              <>
                <span className="text-border">·</span>
                <span>
                  {wordCount} szó · {tartalom.length} karakter
                </span>
              </>
            )}
          </div>
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

      {savedNoteId && (
        <NoteVersionHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          versions={noteVersions}
          onRestore={handleRestoreVersion}
        />
      )}
    </div>
  );
}

export default NoteEditor;
